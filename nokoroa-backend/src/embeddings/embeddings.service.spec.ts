import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { EmbeddingsService } from './embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  const mockPrisma = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };

  // タグ付きテンプレートは (strings, ...values) で呼ばれる。
  // SQL本文は strings の結合、補間値は values 側に入る（＝連結されない）。
  const firstCall = (mock: jest.Mock): [TemplateStringsArray, ...unknown[]] =>
    (mock.mock.calls as [TemplateStringsArray, ...unknown[]][])[0];
  const sqlOf = (mock: jest.Mock): string => firstCall(mock)[0].join('<param>');
  const valuesOf = (mock: jest.Mock): unknown[] => firstCall(mock).slice(1);

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'AI_SERVICE_URL') return 'http://test-ai:8000';
      if (key === 'INTERNAL_AI_TOKEN') return 'test-token';
      return undefined;
    }),
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
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.generateForPost(42, 'タイトル', '本文');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-ai:8000/api/embeddings/',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(sqlOf(mockPrisma.$executeRaw)).toContain(
        'INSERT INTO post_embedding',
      );
      // postId / contentText / ベクタは全てパラメータとして渡る
      expect(valuesOf(mockPrisma.$executeRaw)).toEqual([
        42,
        'タイトル\n\n本文',
        expect.stringMatching(/^\[-?\d/) as unknown,
      ]);
    });

    it('text空のときは何もしない', async () => {
      await service.generateForPost(1, '', '');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('AI service失敗時もthrowせず警告のみ', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500 } as Response),
      ) as unknown as typeof fetch;

      await expect(
        service.generateForPost(1, 'タイトル', '本文'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('AI service に X-Internal-Token header を送る', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.generateForPost(7, 'タイトル', '本文');

      const calls = (
        global.fetch as jest.Mock<
          unknown,
          [string, { headers: Record<string, string> }]
        >
      ).mock.calls;
      const init = calls[0][1];
      expect(init.headers['X-Internal-Token']).toBe('test-token');
    });
  });

  describe('searchSimilar', () => {
    it('クエリを埋め込みコサイン類似度検索する', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { postId: 5, distance: 0.12 },
        { postId: 7, distance: 0.34 },
      ]);

      const hits = await service.searchSimilar('東京 観光', 5);

      expect(hits).toEqual([
        { postId: 5, distance: 0.12 },
        { postId: 7, distance: 0.34 },
      ]);
      const sql = sqlOf(mockPrisma.$queryRaw);
      expect(sql).toContain('embedding <=> <param>::vector');
      expect(sql).toContain('p."isPublic" = true');
      // SQL本文にベクタ値そのものが埋め込まれていないこと
      expect(sql).not.toMatch(/\[[-\d.]+,/);
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

    it('過大なlimitは上限にクランプされる', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.searchSimilar('東京', 1_000_000);

      // values は [literal, literal, limit]。
      // 上限は hnsw.ef_search(既定40)を超えない値であること
      expect(valuesOf(mockPrisma.$queryRaw)[2]).toBe(40);
    });

    it('不正なlimitでも1以上の整数になる', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.searchSimilar('東京', -3);

      expect(valuesOf(mockPrisma.$queryRaw)[2]).toBe(1);
    });
  });

  describe('deleteForPost', () => {
    it('対象postIdの埋め込みを削除する', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await service.deleteForPost(42);

      expect(sqlOf(mockPrisma.$executeRaw)).toContain(
        'DELETE FROM post_embedding',
      );
      expect(valuesOf(mockPrisma.$executeRaw)).toEqual([42]);
    });
  });
});
