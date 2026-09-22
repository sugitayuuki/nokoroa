import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('新規ユーザーを作成できる', async () => {
      const createUserDto = {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      };

      const createdUser = {
        id: 1,
        email: createUserDto.email,
        name: createUserDto.name,
        password: 'hashedPassword',
        bio: null,
        avatar: null,
        googleId: null,
        provider: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(result.message).toBe('ユーザーが正常に作成されました');
      expect(result.user.email).toBe(createUserDto.email);
      expect(result.user).not.toHaveProperty('password');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });
  });

  describe('findById', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      bio: 'Test bio',
      avatar: null,
      googleId: null,
      provider: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      posts: [],
      _count: {
        followers: 10,
        following: 5,
        posts: 3,
      },
    };

    it('IDでユーザーを取得できる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(1, 1);

      expect(result.id).toBe(1);
      expect(result.followersCount).toBe(10);
      expect(result.followingCount).toBe(5);
      expect(result.postsCount).toBe(3);
      expect(result).not.toHaveProperty('password');
    });

    it('本人が取得した場合はメールアドレスを含む', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(1, 1);

      expect(result.email).toBe('test@example.com');
    });

    it('他人・未認証が取得した場合はメールアドレスを含まない', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const asOther = await service.findById(1, 999);
      const asAnonymous = await service.findById(1);

      expect(asOther).not.toHaveProperty('email');
      expect(asAnonymous).not.toHaveProperty('email');
    });

    it('他人・未認証には公開投稿のみをselectする', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.findById(1, 999);

      const [args] = (
        mockPrismaService.user.findUnique as jest.Mock<
          unknown,
          [{ include: { posts: { where?: { isPublic?: boolean } } } }]
        >
      ).mock.calls[0];

      expect(args.include.posts.where).toEqual({ isPublic: true });
    });

    it('本人には非公開投稿も含める', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.findById(1, 1);

      const [args] = (
        mockPrismaService.user.findUnique as jest.Mock<
          unknown,
          [{ include: { posts: { where?: { isPublic?: boolean } } } }]
        >
      ).mock.calls[0];

      expect(args.include.posts.where).toBeUndefined();
    });

    it('存在しないユーザーIDでNotFoundExceptionを投げる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('ログインユーザーのフォロー状態を確認できる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.follow.findUnique.mockResolvedValue({
        id: 1,
        followerId: 2,
        followingId: 1,
      });

      const result = await service.findById(1, 2);

      expect(result.isFollowing).toBe(true);
    });

    it('フォローしていない場合isFollowingがfalse', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.follow.findUnique.mockResolvedValue(null);

      const result = await service.findById(1, 2);

      expect(result.isFollowing).toBe(false);
    });
  });

  describe('update', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      bio: null,
      avatar: null,
      posts: [],
    };

    it('ユーザー情報を更新できる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
        bio: 'Updated bio',
      });

      const result = await service.update(1, {
        name: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.bio).toBe('Updated bio');
    });

    it('存在しないユーザーの更新でNotFoundExceptionを投げる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'Updated Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('name と bio だけを更新し、他のフィールドは書き込まない', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.update(1, { name: 'Updated Name', bio: 'new bio' });

      const [args] = (
        mockPrismaService.user.update as jest.Mock<
          unknown,
          [{ data: Record<string, unknown> }]
        >
      ).mock.calls[0];

      // パスワード・メールアドレスはこの経路では変更できない
      expect(args.data).toEqual({ name: 'Updated Name', bio: 'new bio' });
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password: 'currentHashedPassword',
    };

    it('パスワード未設定(Google連携のみ)のユーザーは400を返す', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: null,
      });

      await expect(
        service.changePassword(1, {
          currentPassword: 'x',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('パスワードを正常に変更できる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.changePassword(1, {
        currentPassword: 'currentPassword',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      });

      expect(result.message).toBe('パスワードが正常に変更されました');
    });

    it('確認パスワードが一致しない場合BadRequestExceptionを投げる', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'currentPassword',
          newPassword: 'newPassword123',
          confirmPassword: 'differentPassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('現在のパスワードが間違っている場合UnauthorizedExceptionを投げる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, {
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('新しいパスワードが現在と同じ場合BadRequestExceptionを投げる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.changePassword(1, {
          currentPassword: 'currentPassword',
          newPassword: 'currentPassword',
          confirmPassword: 'currentPassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAvatar', () => {
    it('アバターURLを更新できる', async () => {
      const updatedUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        bio: null,
        avatar: 'https://example.com/new-avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar(
        1,
        'https://example.com/new-avatar.jpg',
      );

      expect(result.avatar).toBe('https://example.com/new-avatar.jpg');
    });
  });
});
