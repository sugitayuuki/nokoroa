import { Response } from 'express';

import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_EXPIRES_IN_SECONDS,
  SESSION_HINT_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookie,
  sessionHintCookieOptions,
  setAuthCookie,
} from './auth-cookie';
import { jwtModuleOptions } from './auth.module';

describe('auth-cookie', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // jwtModuleOptions() は getJwtSecret() を通るため、鍵を用意しておく
    process.env.JWT_SECRET ??= 'spec-jwt-secret-value-at-least-32-chars-long';
  });

  afterEach(() => {
    // 元が未設定なら delete する。代入すると文字列 "undefined" が入り、
    // 未設定時の挙動を後からテストしたときに原因不明の偽陽性になる
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
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

    it('寿命は 1 日', () => {
      expect(AUTH_COOKIE_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
      expect(authCookieOptions().maxAge).toBe(AUTH_COOKIE_MAX_AGE_MS);
    });

    it('JWT の有効期限とクッキーの寿命が一致する', () => {
      // ずれると「クッキーは残っているが JWT は失効」で全 API が 401 になる。
      // 定数同士ではなく、AuthModule が実際に JwtModule へ渡す値と
      // authCookieOptions() が実際に出す maxAge を突き合わせる
      // （どちらかを '1d' のような別表現に戻すとここで落ちる）。
      const { expiresIn } = jwtModuleOptions().signOptions ?? {};
      expect(typeof expiresIn).toBe('number');
      expect((expiresIn as number) * 1000).toBe(authCookieOptions().maxAge);
      expect(AUTH_TOKEN_EXPIRES_IN_SECONDS).toBe(AUTH_COOKIE_MAX_AGE_MS / 1000);
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

  describe('sessionHintCookieOptions', () => {
    it('フロントが同期で読めるよう httpOnly にしない', () => {
      expect(sessionHintCookieOptions().httpOnly).toBe(false);
    });

    it('httpOnly 以外は認証クッキーと同じ(寿命・送信条件をずらさない)', () => {
      const { httpOnly: _authHttpOnly, ...auth } = authCookieOptions();
      const { httpOnly: _hintHttpOnly, ...hint } = sessionHintCookieOptions();
      expect(hint).toEqual(auth);
    });
  });

  describe('setAuthCookie', () => {
    // 「期待値を authCookieOptions() 自身から作る」比較は定義の言い直しになるため
    // 置かない。属性値の正しさは上の authCookieOptions の各テストが担保する。
    // ここで見るのは「2 本を同時に、正しい名前と値で出す」ことだけ。
    it('トークンとログイン状態ヒントを同時に発行する', () => {
      // 片方だけ出すと「ログイン中の表示なのに 401」か
      // 「ログイン済みなのに未ログイン表示」になる
      const cookie = jest.fn<void, [string, string, object]>();
      const res = { cookie } as unknown as Response;

      setAuthCookie(res, 'jwt-token');

      expect(cookie.mock.calls.map(([name, value]) => [name, value])).toEqual([
        [AUTH_COOKIE_NAME, 'jwt-token'],
        [SESSION_HINT_COOKIE_NAME, '1'],
      ]);
    });

    it('ヒントにトークンを入れない(JS から読めるため)', () => {
      const cookie = jest.fn<void, [string, string, object]>();
      const res = { cookie } as unknown as Response;

      setAuthCookie(res, 'jwt-token');

      const hintCall = cookie.mock.calls.find(
        ([name]) => name === SESSION_HINT_COOKIE_NAME,
      );
      expect(hintCall?.[1]).toBe('1');
      expect(hintCall?.[1]).not.toContain('jwt-token');
    });
  });

  describe('clearAuthCookie', () => {
    it('2 本とも消す', () => {
      // ヒントだけ残ると「未ログインなのにログイン中として描画 → 401」になる
      const clearCookie = jest.fn<void, [string, object]>();
      const res = { clearCookie } as unknown as Response;

      clearAuthCookie(res);

      expect(clearCookie.mock.calls.map(([name]) => name)).toEqual([
        AUTH_COOKIE_NAME,
        SESSION_HINT_COOKIE_NAME,
      ]);
    });

    it('maxAge を渡さない(発行時の属性をそのまま渡さない)', () => {
      // clearCookie は失効済みの expires を入れる。maxAge が同時に渡ると
      // そちらから expires が再計算され、削除にならない実装もある
      const clearCookie = jest.fn<void, [string, Record<string, unknown>]>();
      const res = { clearCookie } as unknown as Response;

      clearAuthCookie(res);

      for (const [, options] of clearCookie.mock.calls) {
        expect(options).not.toHaveProperty('maxAge');
        // Path / SameSite 等は発行時と一致していなければ上書きにならない
        expect(options.path).toBe('/');
        expect(options.sameSite).toBe('lax');
      }
    });
  });
});
