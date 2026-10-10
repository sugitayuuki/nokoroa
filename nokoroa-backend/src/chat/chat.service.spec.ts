import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { ChatService } from './chat.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PostsService } from '../posts/posts.service';

describe('ChatService', () => {
  let service: ChatService;

  const mockPosts = {
    search: jest.fn(),
    findOne: jest.fn(),
    findManyByIds: jest.fn(),
  };
  const mockEmbeddings = {
    searchSimilar: jest.fn(),
  };
  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'AI_SERVICE_URL') return 'http://test-ai:8000';
      if (key === 'INTERNAL_AI_TOKEN') return 'test-token';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PostsService, useValue: mockPosts },
        { provide: EmbeddingsService, useValue: mockEmbeddings },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);

    jest.clearAllMocks();
  });

  // res をそのまま expect に渡すと Response のメソッド型を unbound で参照して
  // しまうため、アサーション用の jest.Mock は個別に返す。
  interface ResHarness {
    res: Response;
    write: jest.Mock;
    end: jest.Mock;
    json: jest.Mock;
    status: jest.Mock;
    /** クライアント切断をシミュレートする */
    disconnect: () => void;
  }

  function makeRes(): ResHarness {
    const listeners: Record<string, Array<() => void>> = {};
    const state = { destroyed: false, writableEnded: false };
    const write = jest.fn();
    const end = jest.fn();
    const json = jest.fn();
    const status = jest.fn().mockReturnThis();
    const on = jest.fn((event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
    });

    const res = {
      setHeader: jest.fn(),
      status,
      json,
      write,
      end,
      on,
      get destroyed() {
        return state.destroyed;
      },
      get writableEnded() {
        return state.writableEnded;
      },
    } as unknown as Response;

    return {
      res,
      write,
      end,
      json,
      status,
      disconnect: () => {
        state.destroyed = true;
        listeners.close?.forEach((cb) => cb());
      },
    };
  }

  function makeStreamFetch(body = 'data: hi\n\n') {
    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: Buffer.from(body) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    }) as unknown as typeof fetch;
    return reader;
  }

  /** streamChat が AI サービスへ送る fetch の第2引数のうち、検証に使う部分 */
  interface StreamFetchInit {
    body: string;
    headers: Record<string, string>;
    signal?: AbortSignal;
  }

  /**
   * /api/chat/stream への fetch 呼び出しを取り出す。
   * 呼ばれていなければ以降のアサーションが成立しないため、ここで落とす。
   */
  function findStreamCall(): [string, StreamFetchInit] {
    const call = (
      global.fetch as jest.Mock<unknown, [string, StreamFetchInit]>
    ).mock.calls.find(([url]) => url.endsWith('/api/chat/stream'));
    if (!call) {
      throw new Error('fetch was not called with /api/chat/stream');
    }
    return call;
  }

  it('ベクトル検索でヒットがあればキーワード検索を呼ばない', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([
      { postId: 1, distance: 0.1 },
    ]);
    mockPosts.findManyByIds.mockResolvedValue([
      {
        id: 1,
        title: 'T',
        content: 'C',
        location: '東京',
        author: { name: 'u' },
      },
    ]);
    makeStreamFetch();

    await service.streamChat({ message: 'test' }, makeRes().res);

    expect(mockEmbeddings.searchSimilar).toHaveBeenCalledWith('test', 5);
    expect(mockPosts.findManyByIds).toHaveBeenCalledWith([1]);
    expect(mockPosts.search).not.toHaveBeenCalled();
  });

  it('AIへ送る履歴は件数と本文長を上限まで切り詰める', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({ posts: [], total: 0, hasMore: false });
    makeStreamFetch();

    const history = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      content: 'x'.repeat(20000),
    }));

    await service.streamChat({ message: 'test', history }, makeRes().res);

    const streamCall = findStreamCall();
    const sent = JSON.parse(streamCall[1].body) as {
      history: { content: string }[];
    };

    // 総文字数バジェット(20000)で打ち切るため、8000文字のターンは
    // 2件フルに入り3件目が端数になる
    const total = sent.history.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBe(20000);
    expect(sent.history.length).toBeLessThan(20);
    // 直近のターンが末尾に残っている(古い側から落ちる)
    expect(sent.history[sent.history.length - 1].content).toHaveLength(8000);
  });

  it('切り詰め位置が絵文字の途中でも孤立サロゲートを残さない', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({ posts: [], total: 0, hasMore: false });
    makeStreamFetch();

    // 総バジェット20000の境界がサロゲートペアの中央に来るよう配置する
    const history = [
      { role: 'user', content: 'あ'.repeat(19999) + '😀' },
      { role: 'model', content: 'ok' },
    ];

    await service.streamChat({ message: 'test', history }, makeRes().res);

    const streamCall = findStreamCall();
    const sent = JSON.parse(streamCall[1].body) as {
      history: { content: string }[];
    };

    for (const msg of sent.history) {
      for (let i = 0; i < msg.content.length; i++) {
        const unit = msg.content.charCodeAt(i);
        const isHigh = unit >= 0xd800 && unit <= 0xdbff;
        const isLow = unit >= 0xdc00 && unit <= 0xdfff;
        if (isHigh) {
          const next = msg.content.charCodeAt(i + 1);
          expect(next >= 0xdc00 && next <= 0xdfff).toBe(true);
          i++;
        } else {
          expect(isLow).toBe(false);
        }
      }
    }
  });

  it('履歴が無い場合は空配列を送る', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({ posts: [], total: 0, hasMore: false });
    makeStreamFetch();

    await service.streamChat({ message: 'test' }, makeRes().res);

    const streamCall = findStreamCall();
    const sent = JSON.parse(streamCall[1].body) as { history: unknown[] };

    expect(sent.history).toEqual([]);
  });

  it('短い履歴はそのまま送る(不要な切り詰めをしない)', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({ posts: [], total: 0, hasMore: false });
    makeStreamFetch();

    const history = [
      { role: 'user', content: 'こんにちは' },
      { role: 'model', content: 'こんにちは。ご旅行のご相談ですか？' },
    ];

    await service.streamChat({ message: 'test', history }, makeRes().res);

    const streamCall = findStreamCall();
    const sent = JSON.parse(streamCall[1].body) as {
      history: { role: string; content: string }[];
    };

    expect(sent.history).toEqual(history);
  });

  it('ベクトル検索ヒット0件ならキーワード検索を呼ぶ', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({
      posts: [
        {
          id: 9,
          title: 'KW',
          content: 'X',
          location: '京都',
          author: { name: 'u' },
        },
      ],
      total: 1,
      hasMore: false,
    });
    makeStreamFetch();

    await service.streamChat({ message: 'test' }, makeRes().res);

    expect(mockEmbeddings.searchSimilar).toHaveBeenCalled();
    expect(mockPosts.search).toHaveBeenCalledWith({
      q: 'test',
      limit: 5,
      offset: 0,
    });
  });

  it('ベクトルもキーワードもヒットなしなら単語分割フォールバックする', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    const fiveHits = Array.from({ length: 5 }, (_, i) => ({
      id: 10 + i,
      title: 'W',
      content: 'X',
      location: '札幌',
      author: { name: 'u' },
    }));
    mockPosts.search
      .mockResolvedValueOnce({ posts: [], total: 0, hasMore: false })
      .mockResolvedValueOnce({ posts: fiveHits, total: 5, hasMore: false });
    makeStreamFetch();

    await service.streamChat({ message: '札幌 ラーメン' }, makeRes().res);

    expect(mockPosts.search).toHaveBeenCalledTimes(2);
  });

  // 埋め込みプロバイダの障害(残高切れ・レート制限など)でベクトル検索が
  // 例外を投げても、外部APIに依存しないDB検索は動けるはずなので落とさない。
  it('ベクトル検索が失敗してもキーワード検索へフォールバックする', async () => {
    mockEmbeddings.searchSimilar.mockRejectedValue(
      new Error('embedding provider unavailable'),
    );
    mockPosts.search.mockResolvedValue({
      posts: [
        {
          id: 42,
          title: 'KW',
          content: 'X',
          location: '京都',
          author: { name: 'u' },
        },
      ],
      total: 1,
      hasMore: false,
    });
    makeStreamFetch();

    await service.streamChat({ message: '京都 2泊3日' }, makeRes().res);

    expect(mockPosts.search).toHaveBeenCalledWith({
      q: '京都 2泊3日',
      limit: 5,
      offset: 0,
    });
    // 検索できただけでなく、結果がAIのコンテキストまで届いていること
    const [, init] = findStreamCall();
    const sent = JSON.parse(init.body) as { context_posts: unknown[] };
    expect(sent.context_posts).toHaveLength(1);
  });

  it('AI service への fetch に X-Internal-Token header を含める', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({
      posts: [],
      total: 0,
      hasMore: false,
    });
    makeStreamFetch();

    await service.streamChat({ message: 'hello' }, makeRes().res);

    const chatStreamCall = findStreamCall();
    const init = chatStreamCall[1];
    expect(init.headers['X-Internal-Token']).toBe('test-token');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  // 「ピエールさんの投稿が見たい」に対し、本文は正しくピエールの投稿2件を
  // 答えているのに、カードには検索ヒット5件(= 別人の投稿を含む)がそのまま
  // 出ていた。本文が触れた投稿だけをカードにすることで食い違いを無くす。
  describe('関連投稿カードを本文に揃える', () => {
    /** related_posts の SSE イベントとして書き出された投稿 ID */
    function relatedPostIds(write: jest.Mock): number[] | null {
      const calls = write.mock.calls as Array<[unknown]>;
      for (const [chunk] of calls) {
        if (typeof chunk !== 'string') continue;
        if (!chunk.startsWith('data: ')) continue;
        const parsed = JSON.parse(chunk.slice('data: '.length)) as {
          type?: string;
          posts?: Array<{ id: number }>;
        };
        if (parsed.type === 'related_posts') {
          return (parsed.posts ?? []).map((p) => p.id);
        }
      }
      return null;
    }

    function post(id: number, title: string, authorName: string) {
      return {
        id,
        title,
        content: 'C',
        location: '東京',
        author: { name: authorName },
      };
    }

    /** AIサービスが返す形(1イベント = data: 行 + 空行)でストリームを作る */
    function makeAnswerStream(chunks: string[]) {
      const frames = [...chunks, '[DONE]'].map(
        (chunk) =>
          chunk
            .split('\n')
            .map((line) => `data: ${line}`)
            .join('\n') + '\n\n',
      );
      const reader = {
        read: jest.fn(),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      for (const frame of frames) {
        reader.read.mockResolvedValueOnce({
          done: false,
          value: Buffer.from(frame),
        });
      }
      reader.read.mockResolvedValue({ done: true, value: undefined });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }) as unknown as typeof fetch;
    }

    const hits = [
      post(1, '築地で出汁の材料を仕入れる朝', 'ピエール'),
      post(2, '金沢で和菓子屋に弟子入りしかけた話', 'ピエール'),
      post(3, '築地場外市場の本格寿司体験', 'アレックス'),
      post(4, '美瑛の丘、曇りの日こそ撮りどきでした', 'マイケル'),
      post(5, '渋谷の夜、スクランブル交差点を真上から', 'ジェームズ'),
    ];

    function setupHits() {
      mockEmbeddings.searchSimilar.mockResolvedValue(
        hits.map((h) => ({ postId: h.id, distance: 0.1 })),
      );
      mockPosts.findManyByIds.mockResolvedValue(hits);
    }

    it('本文が題名に触れた投稿だけをカードにする', async () => {
      setupHits();
      // 題名が複数チャンクに割れても拾えること(SSEの枠が題名を分断する)
      makeAnswerStream([
        'ピエールさんの投稿を2件見つけました。\n\n→ 「築地で出汁の',
        '材料を仕入れる朝」(場所: 築地場外市場)\n',
        '→ 「金沢で和菓子屋に弟子入りしかけた話」',
      ]);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'ピエールさんの投稿みたい' }, res);

      expect(relatedPostIds(write)).toEqual([1, 2]);
    });

    it('本文が題名に触れなければヒット全件に戻す', async () => {
      setupHits();
      makeAnswerStream(['旅行のご相談ですね。どちらへ行かれますか?']);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'こんにちは' }, res);

      expect(relatedPostIds(write)).toEqual([1, 2, 3, 4, 5]);
    });

    it('全角半角や大小文字が違っても題名を照合できる', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([
        { postId: 9, distance: 0.1 },
        { postId: 8, distance: 0.2 },
      ]);
      mockPosts.findManyByIds.mockResolvedValue([
        post(9, 'Tokyo Cafe めぐりの記録', 'マイケル'),
        post(8, '触れられていない別の題名', 'マイケル'),
      ]);
      makeAnswerStream([
        '「ＴＯＫＹＯ　ｃａｆｅ めぐりの記録」が参考になります。',
      ]);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'カフェ' }, res);

      expect(relatedPostIds(write)).toEqual([9]);
    });

    // AIは長い和文題名を要約・省略しがち。全文の逐語一致を求めると、
    // 本文が紹介している投稿までカードから落ちる。
    it('題名が少し言い換えられても本文が紹介した投稿を落とさない', async () => {
      setupHits();
      makeAnswerStream([
        '→ 「築地で出汁の材料を仕入れる朝」\n',
        '→ 金沢で和菓子屋に弟子入りした話の2件です',
      ]);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'ピエールさんの投稿' }, res);

      expect(relatedPostIds(write)).toEqual([1, 2]);
    });

    // 「築地」のような短い題名は、場所名として本文に出ただけで一致してしまう。
    // 言及の有無を判定できないので落とさず残す(従来どおり出る)。
    it('短い題名は判定せず残す', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([
        { postId: 1, distance: 0.1 },
        { postId: 20, distance: 0.2 },
        { postId: 21, distance: 0.3 },
      ]);
      mockPosts.findManyByIds.mockResolvedValue([
        post(1, '築地で出汁の材料を仕入れる朝', 'ピエール'),
        post(20, '築地', 'アレックス'),
        post(21, '触れられていない長い題名の投稿です', 'マイケル'),
      ]);
      makeAnswerStream([
        '→ 「築地で出汁の材料を仕入れる朝」(場所: 築地場外市場)',
      ]);
      const { res, write } = makeRes();

      await service.streamChat({ message: '築地' }, res);

      // 21 は長い題名で本文に出ていないので落ちる
      expect(relatedPostIds(write)).toEqual([1, 20]);
    });

    it('場所名として題名の一部が出ただけの投稿はカードにしない', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([
        { postId: 1, distance: 0.1 },
        { postId: 3, distance: 0.2 },
      ]);
      mockPosts.findManyByIds.mockResolvedValue([
        post(1, '築地で出汁の材料を仕入れる朝', 'ピエール'),
        post(3, '築地場外市場の本格寿司体験', 'アレックス'),
      ]);
      // 本文はアレックスの投稿に触れていない。「築地場外市場」は場所欄。
      makeAnswerStream([
        '→ 「築地で出汁の材料を仕入れる朝」(場所: 築地場外市場)',
      ]);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'ピエールさんの投稿' }, res);

      expect(relatedPostIds(write)).toEqual([1]);
    });

    it('最後のイベントが空行で閉じずに切れても本文の末尾を拾う', async () => {
      setupHits();
      const reader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: Buffer.from(
              'data: 「築地で出汁の材料を仕入れる朝」をご紹介',
            ),
          })
          .mockResolvedValue({ done: true, value: undefined }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }) as unknown as typeof fetch;
      const { res, write } = makeRes();

      await service.streamChat({ message: '築地' }, res);

      expect(relatedPostIds(write)).toEqual([1]);
    });

    // フロントは JSON として読めなければ本文として画面に出す。ここで捨てると
    // 画面に出た本文と照合対象がずれる。
    it('JSONとして読めない { 始まりの本文も照合に使う', async () => {
      setupHits();
      makeAnswerStream(['{これはJSONではない「築地で出汁の材料を仕入れる朝」']);
      const { res, write } = makeRes();

      await service.streamChat({ message: '築地' }, res);

      expect(relatedPostIds(write)).toEqual([1]);
    });

    it('本文がマルチバイトの途中で分割されても題名を取りこぼさない', async () => {
      setupHits();
      const frame = Buffer.from('data: 「築地で出汁の材料を仕入れる朝」\n\n');
      const cut = 10;
      const reader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: frame.subarray(0, cut) })
          .mockResolvedValueOnce({ done: false, value: frame.subarray(cut) })
          .mockResolvedValue({ done: true, value: undefined }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }) as unknown as typeof fetch;
      const { res, write } = makeRes();

      await service.streamChat({ message: '築地' }, res);

      expect(relatedPostIds(write)).toEqual([1]);
    });

    it('番兵を本文として数えない', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([
        { postId: 6, distance: 0.1 },
        { postId: 7, distance: 0.2 },
      ]);
      // 題名が番兵を含む投稿があっても、番兵は本文ではない
      mockPosts.findManyByIds.mockResolvedValue([
        post(6, '[DONE] と書かれた不思議な看板', 'マイケル'),
        post(7, '触れられていない長い題名の投稿です', 'マイケル'),
      ]);
      makeAnswerStream(['旅行のご相談ですね。']);
      const { res, write } = makeRes();

      await service.streamChat({ message: 'test' }, res);

      // どの題名にも触れていないのでヒット全件に戻る
      expect(relatedPostIds(write)).toEqual([6, 7]);
    });
  });

  describe('クライアント切断時の後始末', () => {
    // 切断を検知しないと、タブを閉じた後も AI サービス経由で Gemini の
    // 生成が最後まで走り課金が続く。
    function setupPosts() {
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({ posts: [] });
    }

    it('切断後はクライアントへ write しない', async () => {
      setupPosts();
      const { res, write, disconnect } = makeRes();
      // 1 回目の読み取り中に切断が起き、2 回目以降は done を返す。
      // 無限に done:false を返すと、修正前コードでは無限ループになり
      // テストがクラッシュして「失敗」として観測できなくなる。
      const reader = {
        read: jest
          .fn()
          .mockImplementationOnce(() => {
            disconnect();
            return Promise.resolve({
              done: false,
              value: Buffer.from('data: x\n\n'),
            });
          })
          .mockResolvedValue({ done: true, value: undefined }),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }) as unknown as typeof fetch;

      await service.streamChat({ message: 'test' }, res);

      expect(write).not.toHaveBeenCalled();
    });

    it('上流の body を必ず cancel する', async () => {
      setupPosts();
      const reader = makeStreamFetch();

      await service.streamChat({ message: 'test' }, makeRes().res);

      expect(reader.cancel).toHaveBeenCalled();
    });

    it('切断で fetch の signal が abort される', async () => {
      setupPosts();
      makeStreamFetch();
      const { res, disconnect } = makeRes();

      await service.streamChat({ message: 'test' }, res);

      const streamCall = findStreamCall();
      const signal = streamCall[1].signal;
      expect(signal?.aborted).toBe(false);
      disconnect();
      expect(signal?.aborted).toBe(true);
    });

    it('読み取りが失敗しても end される', async () => {
      setupPosts();
      const reader = {
        read: jest.fn().mockRejectedValue(new Error('aborted')),
        cancel: jest.fn().mockResolvedValue(undefined),
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }) as unknown as typeof fetch;
      const { res, end } = makeRes();

      await expect(
        service.streamChat({ message: 'test' }, res),
      ).resolves.toBeUndefined();
      expect(end).toHaveBeenCalled();
    });
  });
});
