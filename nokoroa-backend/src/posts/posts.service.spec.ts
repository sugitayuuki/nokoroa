import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PostsService } from './posts.service';
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
    },
    bookmark: {
      count: jest.fn(),
    },
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
      email: 'test@example.com',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrismaService },
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

    it('存在しない投稿IDでNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
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

  describe('findByAuthor', () => {
    it('ユーザーの投稿一覧を取得できる', async () => {
      mockPrismaService.post.findMany.mockResolvedValue([mockPost]);
      mockPrismaService.post.count.mockResolvedValue(1);

      const result = await service.findByAuthor(1, 10, 0);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].authorId).toBe(1);
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
});
