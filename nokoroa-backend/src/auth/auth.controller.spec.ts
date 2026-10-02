import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { AUTH_COOKIE_NAME } from './auth-cookie';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleUser } from './strategies/google.strategy';
import { AuthenticatedRequest } from '../common/authenticated-request';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
    googleLogin: jest.fn(),
    getSessionUser: jest.fn(),
  };

  /** cookie / clearCookie / redirect だけを見る最小の Response スタブ */
  const createResponse = () => {
    const cookie = jest.fn<void, [string, string, object]>();
    const clearCookie = jest.fn<void, [string, object]>();
    const redirect = jest.fn<void, [string]>();
    return {
      res: { cookie, clearCookie, redirect } as unknown as Response,
      cookie,
      clearCookie,
      redirect,
    };
  };

  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe('login', () => {
    it('発行した JWT をクッキーに載せる', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'jwt-token',
        user: { id: 1, email: 'test@example.com' },
      });
      const { res, cookie } = createResponse();

      await controller.login(
        { email: 'test@example.com', password: 'password123' },
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });
  });

  describe('logout', () => {
    it('認証クッキーを削除する', () => {
      const { res, clearCookie } = createResponse();

      controller.logout(res);

      expect(clearCookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });
  });

  describe('me', () => {
    it('JWT の userId でセッションのユーザーを引く', async () => {
      mockAuthService.getSessionUser.mockResolvedValue({ id: 7 });
      const req = {
        user: { id: 7, userId: 7, email: 'test@example.com' },
      } as AuthenticatedRequest;

      await controller.me(req);

      expect(mockAuthService.getSessionUser).toHaveBeenCalledWith(7);
    });
  });

  describe('googleAuthRedirect', () => {
    const googleUser: GoogleUser = {
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
      name: 'Google User',
      picture: 'https://example.com/avatar.jpg',
      googleId: 'google-123',
      accessToken: 'google-access-token',
    };

    beforeEach(() => {
      mockAuthService.googleLogin.mockResolvedValue({
        access_token: 'jwt-token',
        user: { id: 1, email: googleUser.email, name: googleUser.name },
      });
      process.env.FRONTEND_URL = 'https://nokoroa.example';
    });

    it('JWT をクッキーで渡す', async () => {
      const { res, cookie } = createResponse();

      await controller.googleAuthRedirect({ user: googleUser } as never, res);

      expect(cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('リダイレクト先 URL にトークンもユーザー情報も載せない', async () => {
      const { res, redirect } = createResponse();

      await controller.googleAuthRedirect({ user: googleUser } as never, res);

      // URL に載せると履歴・アクセスログ・Referer に残るため、
      // クエリ無しの固定パスであることを固定する
      expect(redirect).toHaveBeenCalledWith(
        'https://nokoroa.example/auth/callback',
      );
      const redirectUrl = redirect.mock.calls[0][0];
      expect(redirectUrl).not.toContain('jwt-token');
      expect(redirectUrl).not.toContain('?');
    });
  });
});
