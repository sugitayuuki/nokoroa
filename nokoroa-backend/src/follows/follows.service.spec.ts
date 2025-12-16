import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { FollowsService } from './follows.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FollowsService', () => {
  let service: FollowsService;

  const mockPrismaService = {
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockFollow = {
    id: 1,
    followerId: 1,
    followingId: 2,
    createdAt: new Date(),
    following: {
      id: 2,
      name: 'Following User',
      avatar: null,
    },
    follower: {
      id: 1,
      name: 'Follower User',
      avatar: null,
      bio: 'Test bio',
      _count: {
        followers: 10,
        following: 5,
        posts: 3,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);

    jest.clearAllMocks();
  });

  describe('follow', () => {
    it('ユーザーをフォローできる', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(null);
      mockPrismaService.follow.create.mockResolvedValue(mockFollow);

      const result = await service.follow(1, 2);

      expect(result.followerId).toBe(1);
      expect(result.followingId).toBe(2);
      expect(result.following.name).toBe('Following User');
    });

    it('自分自身をフォローしようとするとConflictExceptionを投げる', async () => {
      await expect(service.follow(1, 1)).rejects.toThrow(ConflictException);
    });

    it('既にフォロー済みの場合ConflictExceptionを投げる', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);

      await expect(service.follow(1, 2)).rejects.toThrow(ConflictException);
    });
  });

  describe('unfollow', () => {
    it('フォローを解除できる', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);
      mockPrismaService.follow.delete.mockResolvedValue(mockFollow);

      const result = await service.unfollow(1, 2);

      expect(result.message).toBe('フォローを解除しました');
    });

    it('フォロー関係がない場合NotFoundExceptionを投げる', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      await expect(service.unfollow(1, 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFollowers', () => {
    it('フォロワー一覧を取得できる', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([mockFollow]);
      mockPrismaService.follow.count.mockResolvedValue(1);

      const result = await service.getFollowers(2, 1, 20);

      expect(result.followers).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('ページネーションが正しく動作する', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([mockFollow]);
      mockPrismaService.follow.count.mockResolvedValue(50);

      const result = await service.getFollowers(2, 1, 20);

      expect(result.totalPages).toBe(3);
    });

    it('フォロワーがいない場合空配列を返す', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([]);
      mockPrismaService.follow.count.mockResolvedValue(0);

      const result = await service.getFollowers(2, 1, 20);

      expect(result.followers).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getFollowing', () => {
    const mockFollowWithFollowing = {
      ...mockFollow,
      following: {
        id: 2,
        name: 'Following User',
        avatar: null,
        bio: 'Following bio',
        _count: {
          followers: 5,
          following: 3,
          posts: 2,
        },
      },
    };

    it('フォロー中ユーザー一覧を取得できる', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([
        mockFollowWithFollowing,
      ]);
      mockPrismaService.follow.count.mockResolvedValue(1);

      const result = await service.getFollowing(1, 1, 20);

      expect(result.following).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('フォロー中がいない場合空配列を返す', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([]);
      mockPrismaService.follow.count.mockResolvedValue(0);

      const result = await service.getFollowing(1, 1, 20);

      expect(result.following).toHaveLength(0);
    });
  });

  describe('checkFollowStatus', () => {
    it('フォロー中の場合trueを返す', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(mockFollow);

      const result = await service.checkFollowStatus(1, 2);

      expect(result.isFollowing).toBe(true);
      expect(result.followedAt).toBeDefined();
    });

    it('フォローしていない場合falseを返す', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      const result = await service.checkFollowStatus(1, 2);

      expect(result.isFollowing).toBe(false);
      expect(result.followedAt).toBeNull();
    });
  });

  describe('getFollowStats', () => {
    it('フォロー統計を取得できる', async () => {
      mockPrismaService.follow.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      const result = await service.getFollowStats(1);

      expect(result.followersCount).toBe(10);
      expect(result.followingCount).toBe(5);
    });

    it('フォロワーもフォロー中もいない場合0を返す', async () => {
      mockPrismaService.follow.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getFollowStats(1);

      expect(result.followersCount).toBe(0);
      expect(result.followingCount).toBe(0);
    });
  });
});
