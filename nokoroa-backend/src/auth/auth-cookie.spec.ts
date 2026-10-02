import { Response } from 'express';

import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookie,
  setAuthCookie,
} from './auth-cookie';

describe('auth-cookie', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('authCookieOptions', () => {
    it('XSS でトークンを読めないよう httpOnly を付ける', () => {
      expect(authCookieOptions().httpOnly).toBe(true);
    });

    it('クロスサイトの更新リクエストに乗らないよう SameSite=Lax を付ける', () => {
      expect(authCookieOptions().sameSite).toBe('lax');
    });

    it('全パスから送られるよう Path=/ を付ける', () => {
      expect(authCookieOptions().path).toBe('/');
    });

    it('寿命は JWT の expiresIn(1d) と同じ', () => {
      expect(AUTH_COOKIE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
      expect(authCookieOptions().maxAge).toBe(AUTH_COOKIE_MAX_AGE_MS);
    });

    it('開発環境は http なので Secure を付けない', () => {
      process.env.NODE_ENV = 'development';
      expect(authCookieOptions().secure).toBe(false);
    });

    it.each(['test', 'staging', 'production', 'prod'])(
      '開発環境以外(%s)では Secure を付ける',
      (nodeEnv) => {
        process.env.NODE_ENV = nodeEnv;
        expect(authCookieOptions().secure).toBe(true);
      },
    );

    it('NODE_ENV 未設定でも Secure を付ける(安全側に倒す)', () => {
      delete process.env.NODE_ENV;
      expect(authCookieOptions().secure).toBe(true);
    });
  });

  describe('setAuthCookie', () => {
    it('規定の名前と属性でトークンを載せる', () => {
      const cookie = jest.fn();
      const res = { cookie } as unknown as Response;

      setAuthCookie(res, 'jwt-token');

      expect(cookie).toHaveBeenCalledWith(
        AUTH_COOKIE_NAME,
        'jwt-token',
        authCookieOptions(),
      );
    });
  });

  describe('clearAuthCookie', () => {
    it('発行時と同じ属性で消す。maxAge だけは外す', () => {
      const clearCookie = jest.fn();
      const res = { clearCookie } as unknown as Response;
      // maxAge を渡すと clearCookie が入れる過去の expires を上書きしてしまい、
      // 削除にならない。完全一致で比較して maxAge の混入ごと検出する
      const { maxAge: _maxAge, ...expected } = authCookieOptions();

      clearAuthCookie(res);

      expect(clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expected);
    });
  });
});
