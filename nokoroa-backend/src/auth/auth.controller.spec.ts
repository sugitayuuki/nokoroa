import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { AUTH_COOKIE_NAME } from './auth-cookie';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleUser } from './strategies/google.strategy';
import { AuthenticatedRequest } from '../common/authenticated-request';

/** googleAuthRedirect が読むのは req.user だけ。型を落とさず最小で満たす。 */
type GoogleAuthRequest = Parameters<AuthController['googleAuthRedirect']>[0];

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
    const setHeader = jest.fn<void, [string, string]>();
    return {
      res: { cookie, clearCookie, redirect, setHeader } as unknown as Response,
      cookie,
      clearCookie,
      redirect,
      setHeader,
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
    // 元が未設定なら delete する。代入すると文字列 "undefined" が入り、
    // 未設定時の挙動を後からテストしたときに原因不明の偽陽性になる
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
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
    /** me は setHeader しか使わない */
    const createHeaderResponse = () => {
      const setHeader = jest.fn<void, [string, string]>();
      return { res: { setHeader } as unknown as Response, setHeader };
    };

    it('JWT の userId でセッションのユーザーを引く', async () => {
      mockAuthService.getSessionUser.mockResolvedValue({ id: 42 });
      // id と userId を別値にして「どちらを使うか」を区別できるようにする
      const req = {
        user: { id: 7, userId: 42, email: 'test@example.com' },
      } as unknown as AuthenticatedRequest;

      await controller.me(req, createHeaderResponse().res);

      expect(mockAuthService.getSessionUser).toHaveBeenCalledWith(42);
    });

    it('本人の情報をキャッシュさせない', async () => {
      mockAuthService.getSessionUser.mockResolvedValue({ id: 7 });
      const { res, setHeader } = createHeaderResponse();

      await controller.me(
        {
          user: { id: 7, userId: 7, email: 'a@b.c' },
        } as unknown as AuthenticatedRequest,
        res,
      );

      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    });
  });

  describe('googleAuthRedirect', () => {
    const googleUser: GoogleUser = {
      email: 'google@example.com',
      name: 'Google User',
      picture: 'https://example.com/avatar.jpg',
      googleId: 'google-123',
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

      await controller.googleAuthRedirect(
        { user: googleUser } as GoogleAuthRequest,
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('リダイレクト先 URL にトークンもユーザー情報も載せない', async () => {
      const { res, redirect } = createResponse();

      await controller.googleAuthRedirect(
        { user: googleUser } as GoogleAuthRequest,
        res,
      );

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
