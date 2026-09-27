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

    const streamCall = (
      global.fetch as jest.Mock<unknown, [string, { body: string }]>
    ).mock.calls.find(([url]) => url.includes('/api/chat/stream'));
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

    const streamCall = (
      global.fetch as jest.Mock<unknown, [string, { body: string }]>
    ).mock.calls.find(([url]) => url.includes('/api/chat/stream'));
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

    const streamCall = (
      global.fetch as jest.Mock<unknown, [string, { body: string }]>
    ).mock.calls.find(([url]) => url.includes('/api/chat/stream'));
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

    const streamCall = (
      global.fetch as jest.Mock<unknown, [string, { body: string }]>
    ).mock.calls.find(([url]) => url.includes('/api/chat/stream'));
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

  it('AI service への fetch に X-Internal-Token header を含める', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({
      posts: [],
      total: 0,
      hasMore: false,
    });
    makeStreamFetch();

    await service.streamChat({ message: 'hello' }, makeRes().res);

    const calls = (
      global.fetch as jest.Mock<
        unknown,
        [string, { headers: Record<string, string> }]
      >
    ).mock.calls;
    const chatStreamCall = calls.find((c) => c[0].endsWith('/api/chat/stream'));
    expect(chatStreamCall).toBeDefined();
    const init = chatStreamCall[1];
    expect(init.headers['X-Internal-Token']).toBe('test-token');
    expect(init.headers['Content-Type']).toBe('application/json');
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

      const streamCall = (
        global.fetch as jest.Mock<unknown, [string, RequestInit]>
      ).mock.calls.find(([url]) => url.includes('/api/chat/stream'));
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
