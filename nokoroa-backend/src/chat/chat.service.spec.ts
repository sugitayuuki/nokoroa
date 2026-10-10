import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { ChatService } from './chat.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';

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
  const mockPrisma = {
    $queryRaw: jest.fn(),
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
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ChatService>(ChatService);

    jest.clearAllMocks();
    // 投稿者の名指しが無い既定。名指しのテストだけが上書きする。
    mockPrisma.$queryRaw.mockResolvedValue([]);
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

  // 「ピエールさんの投稿が見たい」に対し、本文は正しく2件を答えているのに
  // 関連投稿カードには別人の投稿が並ぶ、という食い違いを防ぐ。
  describe('投稿者を名指しした質問', () => {
    /** related_posts の SSE イベントとして書き出された投稿を取り出す */
    function relatedPostsFrom(write: jest.Mock): Array<{ id: number }> | null {
      const calls = write.mock.calls as Array<[unknown]>;
      for (const [chunk] of calls) {
        if (typeof chunk !== 'string') continue;
        if (!chunk.startsWith('data: ')) continue;
        const parsed = JSON.parse(chunk.slice('data: '.length)) as {
          type?: string;
          posts?: Array<{ id: number }>;
        };
        if (parsed.type === 'related_posts') return parsed.posts ?? [];
      }
      return null;
    }

    /**
     * 表示名の候補として DB へ渡された文字列。SQL 自体はモックなので、
     * 「どの範囲を名前として切り出したか」はここでしか検証できない。
     */
    function candidatesSentToDb(): string[] {
      const calls = mockPrisma.$queryRaw.mock.calls as Array<
        [unknown, string[], number]
      >;
      return calls[0][1];
    }

    function post(id: number, createdAt: string, authorName: string) {
      return {
        id,
        title: `T${id}`,
        content: 'C',
        location: '東京',
        createdAt: new Date(createdAt),
        author: { name: authorName },
      };
    }

    it('名指しされた投稿者の投稿だけに絞り、ベクトル検索を使わない', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 7, name: 'ピエール' }]);
      mockPosts.search.mockResolvedValue({
        posts: [post(1, '2025-10-06T17:03:00Z', 'ピエール')],
        total: 1,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: 'ピエールさんの投稿が見たい' },
        makeRes().res,
      );

      expect(candidatesSentToDb()).toContain('ピエール');
      expect(mockPosts.search).toHaveBeenCalledWith({
        authorId: 7,
        limit: 5,
        offset: 0,
      });
      expect(mockEmbeddings.searchSimilar).not.toHaveBeenCalled();
    });

    it('名前の手前に文が続いていても名前だけを切り出す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 7, name: 'ピエール' }]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: '今日はピエールさんの投稿が見たい' },
        makeRes().res,
      );

      expect(candidatesSentToDb()).toContain('ピエール');
    });

    it('姓名が空白で割れていても1つの名前として切り出す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 2, name: '裕貴 杉田' }]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: '裕貴 杉田さんの投稿' },
        makeRes().res,
      );

      expect(candidatesSentToDb()).toContain('裕貴 杉田');
    });

    // 部分一致で引くと利用者「太郎」が「健太郎さん」の質問を奪ってしまう。
    // 本PRが直そうとしている「別人の投稿が並ぶ」症状の再発にあたる。
    it('他人の名前の一部に含まれる表示名を候補にしない', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: '健太郎さんの投稿が見たい' },
        makeRes().res,
      );

      expect(candidatesSentToDb()).toContain('健太郎');
      expect(candidatesSentToDb()).not.toContain('太郎');
    });

    // 表示名は一意でも不変でもないため、地名と同じ名前を登録して
    // 「京都の投稿」のような質問の検索結果を奪えてはいけない。
    it('敬称が無ければ著者指名とみなさない', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: '京都の神社の投稿が見たい' },
        makeRes().res,
      );

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockEmbeddings.searchSimilar).toHaveBeenCalled();
    });

    it('投稿を指す語が無ければ著者指名とみなさない', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: '田中さんに教わった京都の店' },
        makeRes().res,
      );

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('複数人を名指しされたら全員の投稿を新しい順に混ぜる', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 3, name: 'ジェームズ' },
        { id: 7, name: 'ピエール' },
      ]);
      mockPosts.search
        .mockResolvedValueOnce({
          posts: [
            post(10, '2025-01-01T00:00:00Z', 'ジェームズ'),
            post(11, '2025-05-01T00:00:00Z', 'ジェームズ'),
          ],
          total: 2,
          hasMore: false,
        })
        .mockResolvedValueOnce({
          posts: [post(20, '2025-09-01T00:00:00Z', 'ピエール')],
          total: 1,
          hasMore: false,
        });
      makeStreamFetch();
      const { res, write } = makeRes();

      await service.streamChat(
        { message: 'ジェームズさんとピエールさんの投稿を見たい' },
        res,
      );

      expect(mockPosts.search).toHaveBeenCalledWith({
        authorId: 3,
        limit: 5,
        offset: 0,
      });
      expect(mockPosts.search).toHaveBeenCalledWith({
        authorId: 7,
        limit: 5,
        offset: 0,
      });
      expect(relatedPostsFrom(write)?.map((p) => p.id)).toEqual([20, 11, 10]);
    });

    // ここで通常の検索へ落とすと、名指しされていない投稿者の投稿が
    // カードに並ぶ(修正前の挙動そのもの)。
    it('名指しされた投稿者の投稿が0件なら他人の投稿へ落とさない', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 7, name: 'ピエール' }]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();
      const { res, write } = makeRes();

      await service.streamChat({ message: 'ピエールさんの投稿' }, res);

      expect(mockPosts.search).toHaveBeenCalledTimes(1);
      expect(mockEmbeddings.searchSimilar).not.toHaveBeenCalled();
      expect(relatedPostsFrom(write)).toBeNull();
      const sent = JSON.parse(findStreamCall()[1].body) as {
        context_posts: unknown[];
      };
      expect(sent.context_posts).toEqual([]);
    });

    it('大小文字が違っても表示名を解決できる', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 4, name: 'Alex Smith' }]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: 'alex smithさんの投稿' },
        makeRes().res,
      );

      // 小文字化は SQL 側 (lower) で行うため、候補は原文のまま渡る
      expect(candidatesSentToDb()).toContain('alex smith');
      expect(mockPosts.search).toHaveBeenCalledWith({
        authorId: 4,
        limit: 5,
        offset: 0,
      });
    });

    it('名指しが多すぎる場合は絞り込まない', async () => {
      // 上限超過の検知のため、実装は上限+1件を取得する
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 1, name: 'あ' },
        { id: 2, name: 'い' },
        { id: 3, name: 'う' },
        { id: 4, name: 'え' },
      ]);
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: 'あさんといさんとうさんとえさんの投稿' },
        makeRes().res,
      );

      expect(mockEmbeddings.searchSimilar).toHaveBeenCalled();
    });

    it('投稿者解決が失敗しても通常の検索へフォールバックする', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'));
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat(
        { message: 'ピエールさんの投稿' },
        makeRes().res,
      );

      expect(mockEmbeddings.searchSimilar).toHaveBeenCalled();
    });

    it('投稿者を名指ししていない質問ではDBへ問い合わせない', async () => {
      mockEmbeddings.searchSimilar.mockResolvedValue([]);
      mockPosts.search.mockResolvedValue({
        posts: [],
        total: 0,
        hasMore: false,
      });
      makeStreamFetch();

      await service.streamChat({ message: '京都 2泊3日' }, makeRes().res);

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
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
