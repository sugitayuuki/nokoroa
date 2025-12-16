import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      bio: null,
      avatar: null,
      googleId: null,
      provider: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('正しい認証情報でユーザーを返す', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('ユーザーが存在しない場合nullを返す', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password',
      );

      expect(result).toBeNull();
    });

    it('パスワードが間違っている場合nullを返す', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
      bio: null,
      avatar: null,
      googleId: null,
      provider: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('正しい認証情報でトークンとユーザーを返す', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login('test@example.com', 'password');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 1,
      });
    });

    it('認証失敗時にUnauthorizedExceptionを投げる', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    const googleUser = {
      googleId: 'google-123',
      email: 'google@example.com',
      name: 'Google User',
      firstName: 'Google',
      lastName: 'User',
      picture: 'https://example.com/avatar.jpg',
      accessToken: 'mock-access-token',
    };

    it('既存のGoogleユーザーでログインできる', async () => {
      const existingUser = {
        id: 1,
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.googleId,
        avatar: googleUser.picture,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.googleLogin(googleUser);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe(googleUser.email);
    });

    it('新規Googleユーザーを作成してログインできる', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const newUser = {
        id: 2,
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.googleId,
        avatar: googleUser.picture,
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.googleLogin(googleUser);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('既存のメールユーザーにGoogleIdを紐付ける', async () => {
      const existingEmailUser = {
        id: 1,
        email: googleUser.email,
        name: 'Existing User',
        googleId: null,
        avatar: null,
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingEmailUser);

      const updatedUser = {
        ...existingEmailUser,
        googleId: googleUser.googleId,
        avatar: googleUser.picture,
        provider: 'google',
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.googleLogin(googleUser);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });
});
