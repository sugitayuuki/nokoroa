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
