import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockPrismaService = {
    post: {
      findUnique: jest.fn(),
    },
    bookmark: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
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
    locationId: null,
    author: {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      avatar: null,
    },
    location: null,
    postTags: [],
    _count: { bookmarks: 5 },
  };

  const mockBookmark = {
    id: 1,
    userId: 1,
    postId: 1,
    createdAt: new Date(),
    post: mockPost,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);

    jest.clearAllMocks();
  });

  describe('addFavorite', () => {
    it('投稿をブックマークできる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null);
      mockPrismaService.bookmark.create.mockResolvedValue(mockBookmark);

      const result = await service.addFavorite(1, 1);

      expect(result.id).toBe(1);
      expect(result.post.title).toBe('Test Post');
    });

    it('存在しない投稿のブックマークでNotFoundExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(null);

      await expect(service.addFavorite(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('既にブックマーク済みの場合ConflictExceptionを投げる', async () => {
      mockPrismaService.post.findUnique.mockResolvedValue(mockPost);
      mockPrismaService.bookmark.findUnique.mockResolvedValue(mockBookmark);

      await expect(service.addFavorite(1, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeFavorite', () => {
    it('ブックマークを削除できる', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(mockBookmark);
      mockPrismaService.bookmark.delete.mockResolvedValue(mockBookmark);

      const result = await service.removeFavorite(1, 1);

      expect(result.message).toBe('Favorite removed successfully');
    });

    it('存在しないブックマークの削除でNotFoundExceptionを投げる', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null);

      await expect(service.removeFavorite(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserFavorites', () => {
    it('ユーザーのブックマーク一覧を取得できる', async () => {
      mockPrismaService.bookmark.findMany.mockResolvedValue([mockBookmark]);
      mockPrismaService.bookmark.count.mockResolvedValue(1);

      const result = await service.getUserFavorites(1, 10, 0);

      expect(result.favorites).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('ページネーションが正しく動作する', async () => {
      mockPrismaService.bookmark.findMany.mockResolvedValue([mockBookmark]);
      mockPrismaService.bookmark.count.mockResolvedValue(15);

      const result = await service.getUserFavorites(1, 10, 0);

      expect(result.hasMore).toBe(true);
    });

    it('ブックマークがない場合空配列を返す', async () => {
      mockPrismaService.bookmark.findMany.mockResolvedValue([]);
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      const result = await service.getUserFavorites(1, 10, 0);

      expect(result.favorites).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('checkFavoriteStatus', () => {
    it('ブックマーク済みの場合trueを返す', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(mockBookmark);

      const result = await service.checkFavoriteStatus(1, 1);

      expect(result.isFavorited).toBe(true);
    });

    it('ブックマークしていない場合falseを返す', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null);

      const result = await service.checkFavoriteStatus(1, 1);

      expect(result.isFavorited).toBe(false);
    });
  });

  describe('getFavoriteStats', () => {
    it('投稿のブックマーク数を取得できる', async () => {
      mockPrismaService.bookmark.count.mockResolvedValue(10);

      const result = await service.getFavoriteStats(1);

      expect(result.favoritesCount).toBe(10);
    });

    it('ブックマークがない場合0を返す', async () => {
      mockPrismaService.bookmark.count.mockResolvedValue(0);

      const result = await service.getFavoriteStats(999);

      expect(result.favoritesCount).toBe(0);
    });
  });
});
