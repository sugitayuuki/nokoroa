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
    get: jest.fn(() => 'http://test-ai:8000'),
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

  function makeRes(): Response {
    return {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;
  }

  function makeStreamFetch(body = 'data: hi\n\n') {
    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: Buffer.from(body) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    }) as unknown as typeof fetch;
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

    await service.streamChat({ message: 'test' }, makeRes());

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

    await service.streamChat({ message: 'test', history }, makeRes());

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

  it('履歴が無い場合は空配列を送る', async () => {
    mockEmbeddings.searchSimilar.mockResolvedValue([]);
    mockPosts.search.mockResolvedValue({ posts: [], total: 0, hasMore: false });
    makeStreamFetch();

    await service.streamChat({ message: 'test' }, makeRes());

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

    await service.streamChat({ message: 'test', history }, makeRes());

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

    await service.streamChat({ message: 'test' }, makeRes());

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

    await service.streamChat({ message: '札幌 ラーメン' }, makeRes());

    expect(mockPosts.search).toHaveBeenCalledTimes(2);
  });
});
