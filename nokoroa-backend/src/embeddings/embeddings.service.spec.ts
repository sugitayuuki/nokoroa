import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { EmbeddingsService } from './embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  const mockPrisma = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) =>
      key === 'AI_SERVICE_URL' ? 'http://test-ai:8000' : undefined,
    ),
  };

  const mockEmbedding = Array.from({ length: 768 }, (_, i) => i / 768);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<EmbeddingsService>(EmbeddingsService);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding }),
      } as Response),
    ) as unknown as typeof fetch;

    jest.clearAllMocks();
  });

  describe('generateForPost', () => {
    it('AI serviceを呼びvectorをDBにupsertする', async () => {
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await service.generateForPost(42, 'タイトル', '本文');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-ai:8000/api/embeddings/',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      const calls = (
        mockPrisma.$executeRawUnsafe as jest.Mock<
          unknown,
          [string, ...unknown[]]
        >
      ).mock.calls;
      const sql = calls[0][0];
      expect(sql).toContain('INSERT INTO post_embedding');
    });

    it('text空のときは何もしない', async () => {
      await service.generateForPost(1, '', '');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('AI service失敗時もthrowせず警告のみ', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500 } as Response),
      ) as unknown as typeof fetch;

      await expect(
        service.generateForPost(1, 'タイトル', '本文'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('searchSimilar', () => {
    it('クエリを埋め込みコサイン類似度検索する', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { postId: 5, distance: 0.12 },
        { postId: 7, distance: 0.34 },
      ]);

      const hits = await service.searchSimilar('東京 観光', 5);

      expect(hits).toEqual([
        { postId: 5, distance: 0.12 },
        { postId: 7, distance: 0.34 },
      ]);
      const calls = (
        mockPrisma.$queryRawUnsafe as jest.Mock<unknown, [string, ...unknown[]]>
      ).mock.calls;
      const sql = calls[0][0];
      expect(sql).toContain('embedding <=> $1::vector');
      expect(sql).toContain('p."isPublic" = true');
    });

    it('queryが空なら[]', async () => {
      const hits = await service.searchSimilar('  ', 5);
      expect(hits).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('AI service失敗時は[]を返す', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 502 } as Response),
      ) as unknown as typeof fetch;

      const hits = await service.searchSimilar('test', 5);
      expect(hits).toEqual([]);
    });
  });
});
