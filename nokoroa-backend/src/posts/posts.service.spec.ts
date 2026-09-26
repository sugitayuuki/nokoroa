import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { PostsService } from './posts.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostsService', () => {
  let service: PostsService;

  const mockPrismaService = {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    postTag: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    bookmark: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    // インタラクティブトランザクション。コールバックへ同じモックを渡して
    // 実行することで、tx 経由の呼び出しも同じ jest.fn() で観測できる。
    $transaction: jest.fn(
      (fn: (tx: typeof mockPrismaService) => unknown): Promise<unknown> =>
        Promise.resolve(fn(mockPrismaService)),
    ),
  };

  const mockPost = {
    id: 1,
    title: 'Test Post',
    content: 'Test content',
    imageUrl: 'https://example.com/image.jpg',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    authorId: 1,
    locationId: 1,
    author: {
      id: 1,
      name: 'Test User',
      avatar: null,
    },
    location: {
      id: 1,
      name: 'Tokyo',
      country: 'Japan',
      prefecture: 'Tokyo',
      latitude: 35.6762,
      longitude: 139.6503,
      createdAt: new Date(),
    },
    postTags: [
      {
        id: 1,
        postId: 1,
        tagId: 1,
        tag: { id: 1, name: 'travel', slug: 'travel' },
      },
    ],
  };

  const mockEmbeddingsService = {
    generateForPost: jest.fn().mockResolvedValue(undefined),
    deleteForPost: jest.fn().mockResolvedValue(undefined),
    searchSimilar: jest.fn().mockResolvedValue([]),
    searchSimilarStrict: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmbeddingsService, useValue: mockEmbeddingsService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('新規投稿を作成できる', async () => {
      mockPrismaService.location.findFirst.mockResolvedValue(null);
      mockPrismaService.location.create.mockResolvedValue({
        id: 1,
        name: 'Tokyo',
      });
      mockPrismaService.tag.findUnique.mockResolvedValue(null);
      mockPrismaService.tag.create.mockResolvedValue({
        id: 1,
        name: 'travel',
        slug: 'travel',
      });
      mockPrismaService.post.create.mockResolvedValue(mockPost);

      const result = await service.create({
        title: 'Test Post',
        content: 'Test content',
        imageUrl: 'https://example.com/image.jpg',
        location: 'Tokyo',
        tags: ['travel'],
        authorId: 1,
      });

      expect(result.title).toBe('Test Post');
      expect(result.tags).toContain('travel');
    });

    it('位置情報なしで投稿を作成できる', async () => {
      mockPrismaService.post.create.mockResolvedValue({
        ...mockPost,
        locationId: null,
        location: null,
      });

      const result = await service.create({
        title: 'Test Post',
        content: 'Test content',
        imageUrl: 'https://example.com/image.jpg',
        authorId: 1,
      });

      expect(result.title).toBe('Test Post');
      expect(result.location).toBeNull();
    });

    it('公開投稿は埋め込みを生成する', async () => {
      mockPrismaService.post.create.mockResolvedValue({
        ...mockPost,
        locationId: null,
        location: null,
      });

      await service.create({
        title: 'Test Post',
        content: 'Test content',
        imageUrl: 'https://example.com/image.jpg',
        authorId: 1,
      });

      expect(mockEmbeddingsService.generateForPost).toHaveBeenCalledWith(
        1,
        'Test Post',
        'Test content',
      );
      expect(mockEmbeddingsService.deleteForPost).not.toHaveBeenCalled();
    });

    it('非公開投稿は本文を外部AIへ送らず既存の埋め込みを削除する', async () => {
      mockPrismaService.post.create.mockResolvedValue({
        ...mockPost,
        isPublic: false,
        locationId: null,
        location: null,
      });

      await service.create({
        title: 'Test Post',
        content: 'Test content',
        imageUrl: 'https://example.com/image.jpg',
        authorId: 1,
        isPublic: false,
      });

      expect(mockEmbeddingsService.generateForPost).not.toHaveBeenCalled();
      expect(mockEmbeddingsService.deleteForPost).toHaveBeenCalledWith(1);
    });
  });

  describe('findAll', () => {
    it('公開投稿一覧を取得できる', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(1);

      const result = await service.findAll(10, 0);

      expect(result.posts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('ページネーションが正しく動作する', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(15);

      const result = await service.findAll(10, 0);

      expect(result.hasMore).toBe(true);
    });
  });

  describe('findOne', () => {
    it('IDで投稿を取得できる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockPrismaService.bookmark.count.mockResolvedValue(5);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Post');
      expect(result.favoritesCount).toBe(5);
    });

    it('緯度0・経度0の座標をnullに潰さない', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        ...mockPost,
        location: {
          id: 2,
          name: 'ヌル島',
          country: 'N/A',
          prefecture: '',
          latitude: 0,
          longitude: 0,
          createdAt: new Date(),
        },
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      const result = await service.findOne(1);

      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
      expect(result.prefecture).toBe('');
    });

    it('存在しない投稿IDでNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('非公開投稿は未認証ユーザーに対してNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        ...mockPost,
        isPublic: false,
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });

    it('非公開投稿は他人に対してNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        ...mockPost,
        isPublic: false,
        authorId: 1,
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      await expect(service.findOne(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('非公開投稿を投稿者本人は取得できる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({
        ...mockPost,
        isPublic: false,
        authorId: 1,
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      const result = await service.findOne(1, 1);

      expect(result.id).toBe(1);
    });

    it('投稿者のメールアドレスをselectしない', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      await service.findOne(1);

      const [args] = (
        mockPrismaService.post.findUnique as jest.Mock<
          unknown,
          [{ include: { author: { select: Record<string, boolean> } } }]
        >
      ).mock.calls[0];

      expect(args.include.author.select).toEqual({
        id: true,
        name: true,
        avatar: true,
      });
    });
  });

  describe('update', () => {
    it('自分の投稿を更新できる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        title: 'Updated Title',
      });
      mockPrismaService.bookmark.count.mockResolvedValue(5);

      const result = await service.update(1, { title: 'Updated Title' }, 1);

      expect(result.title).toBe('Updated Title');
    });

    it('isPublicを送らない部分更新では公開投稿の埋め込みを消さない', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
      // isPublic を含まない更新でも、DBの確定値(isPublic: true)が返る
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        title: 'Updated Title',
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      await service.update(1, { title: 'Updated Title' }, 1);

      expect(mockEmbeddingsService.generateForPost).toHaveBeenCalledWith(
        1,
        'Updated Title',
        'Test content',
      );
      expect(mockEmbeddingsService.deleteForPost).not.toHaveBeenCalled();
    });

    it('非公開化した更新では埋め込みを削除する', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        isPublic: false,
      });
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      await service.update(1, { isPublic: false }, 1);

      expect(mockEmbeddingsService.generateForPost).not.toHaveBeenCalled();
      expect(mockEmbeddingsService.deleteForPost).toHaveBeenCalledWith(1);
    });

    it('存在しない投稿の更新でNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { title: 'Updated Title' }, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('他人の投稿更新でForbiddenExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 2 });

      await expect(
        service.update(1, { title: 'Updated Title' }, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('タグを更新できる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
      mockPrismaService.postTag.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.tag.findUnique.mockResolvedValue({
        id: 2,
        name: 'newtag',
        slug: 'newtag',
      });
      mockPrismaService.postTag.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.post.update.mockResolvedValue({
        ...mockPost,
        postTags: [
          {
            id: 2,
            postId: 1,
            tagId: 2,
            tag: { id: 2, name: 'newtag', slug: 'newtag' },
          },
        ],
      });
      mockPrismaService.bookmark.count.mockResolvedValue(5);

      await service.update(1, { tags: ['newtag'] }, 1);

      expect(mockPrismaService.postTag.deleteMany).toHaveBeenCalledWith({
        where: { postId: 1 },
      });
    });

    describe('タグ張り替えの不可分性', () => {
      // 削除だけがコミットされてタグが消えた投稿が残る事故を防ぐ。
      function setupOwner() {
        mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
        mockPrismaService.bookmark.count.mockResolvedValue(0);
      }

      it('タグ解決に失敗したら既存タグを削除しない', async () => {
        setupOwner();
        // findUnique が null -> create が P2002 以外で落ちる = 解決不能
        mockPrismaService.tag.findUnique.mockResolvedValue(null);
        mockPrismaService.tag.create.mockRejectedValue(new Error('db down'));

        await expect(
          service.update(1, { tags: ['newtag'] }, 1),
        ).rejects.toThrow('db down');

        expect(mockPrismaService.postTag.deleteMany).not.toHaveBeenCalled();
      });

      it('削除・作成・本体更新を同一トランザクションで行う', async () => {
        setupOwner();
        mockPrismaService.tag.findUnique.mockResolvedValue({
          id: 2,
          name: 'newtag',
          slug: 'newtag',
        });
        mockPrismaService.postTag.deleteMany.mockResolvedValue({ count: 1 });
        mockPrismaService.postTag.createMany.mockResolvedValue({ count: 1 });
        mockPrismaService.post.update.mockResolvedValue(mockPost);

        await service.update(1, { tags: ['newtag'], title: 'T' }, 1);

        expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
        // トランザクション外で先に走ってよいのはタグ解決だけ
        const txCallOrder =
          mockPrismaService.$transaction.mock.invocationCallOrder[0];
        expect(
          mockPrismaService.tag.findUnique.mock.invocationCallOrder[0],
        ).toBeLessThan(txCallOrder);
        expect(
          mockPrismaService.postTag.deleteMany.mock.invocationCallOrder[0],
        ).toBeGreaterThan(txCallOrder);
        expect(
          mockPrismaService.post.update.mock.invocationCallOrder[0],
        ).toBeGreaterThan(txCallOrder);
      });

      it('同名タグの競合(P2002)は取り直して継続する', async () => {
        setupOwner();
        const conflict = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: 'test' },
        );
        // 1回目: 未存在 -> create が競合 -> 取り直しで見つかる
        mockPrismaService.tag.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 9, name: 'race', slug: 'race' });
        mockPrismaService.tag.create.mockRejectedValue(conflict);
        mockPrismaService.postTag.deleteMany.mockResolvedValue({ count: 0 });
        mockPrismaService.postTag.createMany.mockResolvedValue({ count: 1 });
        mockPrismaService.post.update.mockResolvedValue(mockPost);

        await expect(
          service.update(1, { tags: ['race'] }, 1),
        ).resolves.toBeDefined();

        expect(mockPrismaService.postTag.createMany).toHaveBeenCalledWith({
          data: [{ postId: 1, tagId: 9 }],
        });
      });
    });
  });

  describe('remove', () => {
    it('自分の投稿を削除できる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 1 });
      mockPrismaService.post.delete.mockResolvedValue(mockPost);

      await expect(service.remove(1, 1)).resolves.toBeUndefined();
    });

    it('存在しない投稿の削除でNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('他人の投稿削除でForbiddenExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue({ authorId: 2 });

      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('search', () => {
    it('キーワードで検索できる', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(1);

      const result = await service.search({ q: 'Test' });

      expect(result.posts).toHaveLength(1);
    });

    it('タグで検索できる', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(1);

      const result = await service.search({ tags: ['travel'] });

      expect(result.posts).toHaveLength(1);
    });

    it('複数条件で検索できる', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(1);

      const result = await service.search({
        q: 'Test',
        tags: ['travel'],
        location: 'Tokyo',
      });

      expect(result.posts).toHaveLength(1);
    });
  });

  describe('searchSemantic', () => {
    it('ヒットIDを類似度付きで返す（hit順を保つ）', async () => {
      mockEmbeddingsService.searchSimilarStrict.mockResolvedValueOnce([
        { postId: 2, distance: 0.1 },
        { postId: 1, distance: 0.4 },
      ]);
      mockPrismaService.post.findMany.mockResolvedValue([
        { ...mockPost, id: 1 },
        { ...mockPost, id: 2 },
      ]);

      const result = await service.searchSemantic({
        q: '紅葉と温泉',
        limit: 5,
      });

      expect(mockEmbeddingsService.searchSimilarStrict).toHaveBeenCalledWith(
        '紅葉と温泉',
        5,
      );
      expect(result.posts.map((p) => p.id)).toEqual([2, 1]);
      expect(result.posts[0].similarity).toBeCloseTo(0.9);
      expect(result.posts[1].similarity).toBeCloseTo(0.6);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.aiAvailable).toBe(true);
    });

    it('AI service エラー時は aiAvailable=false で空結果', async () => {
      mockEmbeddingsService.searchSimilarStrict.mockRejectedValueOnce(
        new Error('embedding service responded 503'),
      );

      const result = await service.searchSemantic({ q: 'q', limit: 5 });

      expect(result.posts).toEqual([]);
      expect(result.aiAvailable).toBe(false);
    });

    it('ヒット0件なら空結果', async () => {
      mockEmbeddingsService.searchSimilarStrict.mockResolvedValueOnce([]);

      const result = await service.searchSemantic({ q: 'なし', limit: 5 });

      expect(result.posts).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
    });

    it('distance が 1 を超えても similarity は 0 にクランプする', async () => {
      mockEmbeddingsService.searchSimilarStrict.mockResolvedValueOnce([
        { postId: 1, distance: 1.5 },
      ]);
      mockPrismaService.post.findMany.mockResolvedValue([
        { ...mockPost, id: 1 },
      ]);

      const result = await service.searchSemantic({ q: 'q', limit: 5 });

      expect(result.posts[0].similarity).toBe(0);
    });
  });

  describe('getTags', () => {
    it('タグ一覧を取得できる', async () => {
      mockPrismaService.tag = {
        findMany: jest.fn().mockResolvedValue([
          { name: 'travel', slug: 'travel', _count: { postTags: 5 } },
          { name: 'food', slug: 'food', _count: { postTags: 3 } },
        ]),
      } as unknown as typeof mockPrismaService.tag;

      const result = await service.getTags();

      expect(result.tags).toHaveLength(2);
      expect(result.tags[0].count).toBe(5);
    });
  });

  describe('searchByLocation', () => {
    const rawRow = {
      id: 1,
      title: 'Cafe Visit',
      content: 'Nice cafe',
      imageUrl: null,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: 1,
      locationId: 1,
      author_id: 1,
      author_name: 'Alice',
      author_email: 'alice@example.com',
      author_avatar: null,
      location_name: 'Shibuya',
      prefecture: 'Tokyo',
      latitude: 35.6595,
      longitude: 139.7005,
      distance: 1.23,
      tags: ['cafe', 'travel'],
      total_count: BigInt(1),
    };

    it('geo 指定ありで distance を含めて返す', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([rawRow]);

      const result = await service.searchByLocation({
        centerLat: 35.6762,
        centerLng: 139.6503,
        radius: 5,
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).toMatchObject({
        id: 1,
        location: 'Shibuya',
        tags: ['cafe', 'travel'],
        distance: 1.23,
      });
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('centerLat=0 を有効値として扱う (truthiness バグ防止)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { ...rawRow, distance: 0.5, total_count: BigInt(1) },
      ]);

      const result = await service.searchByLocation({
        centerLat: 0,
        centerLng: 0,
        radius: 50,
      });

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.posts[0].distance).toBe(0.5);
    });

    it('geo なしのとき distance を含めない', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { ...rawRow, distance: null, total_count: BigInt(1) },
      ]);

      const result = await service.searchByLocation({});

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).not.toHaveProperty('distance');
    });

    it('結果 0 件のとき total=0, hasMore=false', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.searchByLocation({
        centerLat: 35.6762,
        centerLng: 139.6503,
      });

      expect(result.posts).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('tags が null でも空配列にフォールバック', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { ...rawRow, tags: null },
      ]);

      const result = await service.searchByLocation({});

      expect(result.posts[0].tags).toEqual([]);
    });
  });

  describe('getOrCreateLocation race safety (via create flow)', () => {
    it('Location create が P2002 で衝突したら findFirst で再取得', async () => {
      const existing = {
        id: 99,
        name: 'Race City',
        prefecture: null,
        latitude: null,
        longitude: null,
      };

      mockPrismaService.location.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      mockPrismaService.location.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      mockPrismaService.tag.findUnique = jest.fn().mockResolvedValue(null);
      mockPrismaService.tag.create = jest.fn().mockResolvedValue({
        id: 1,
        name: 'travel',
        slug: 'travel',
      });
      mockPrismaService.post.create.mockResolvedValue({
        ...mockPost,
        locationId: existing.id,
      });

      const result = await service.create({
        title: 'Race Post',
        content: 'Body',
        imageUrl: 'https://example.com/img.jpg',
        location: 'Race City',
        tags: ['travel'],
        authorId: 1,
      });

      expect(result.title).toBe('Test Post');
      expect(mockPrismaService.location.findFirst).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.location.create).toHaveBeenCalledTimes(1);
    });

    it('Location create が他エラーなら投げ直す', async () => {
      mockPrismaService.location.findFirst.mockResolvedValue(null);
      mockPrismaService.location.create.mockRejectedValue(
        new Error('connection lost'),
      );

      await expect(
        service.create({
          title: 'Post',
          content: 'Body',
          imageUrl: 'https://example.com/img.jpg',
          location: 'Anywhere',
          authorId: 1,
        }),
      ).rejects.toThrow('connection lost');
    });
  });
});
