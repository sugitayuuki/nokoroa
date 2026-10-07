import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG } from '@/lib/apiConfig';
import {
  fetchAuthSession,
  resolveAuthState,
  toAuthUser,
} from '@/lib/authSession';

const { createApiRequest } = vi.hoisted(() => ({
  createApiRequest: vi.fn(),
}));

// createApiRequest だけ差し替える。API_CONFIG は実物を使い、
// エンドポイントの改名がテストをすり抜けないようにする
vi.mock('@/lib/apiConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiConfig')>()),
  createApiRequest: (...args: unknown[]) => createApiRequest(...args),
}));

/** 本物の Response を使い、ok 判定と JSON パースを実装に委ねる */
const respond = (status: number, body: unknown = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
  });

const validProfile = {
  id: 2,
  name: '裕貴 杉田',
  email: 'user@example.com',
  avatar: 'https://example.com/a.png',
};

beforeEach(() => {
  createApiRequest.mockReset();
});

describe('fetchAuthSession', () => {
  it('プロフィール API を中断可能な形で叩く', async () => {
    createApiRequest.mockResolvedValue(respond(200, validProfile));

    await fetchAuthSession();

    // 応答しないサーバで画面が固着しないよう signal が必須
    expect(createApiRequest).toHaveBeenCalledWith(
      API_CONFIG.endpoints.userProfile,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('200 ならセッション有効として user を組み立てる', async () => {
    createApiRequest.mockResolvedValue(respond(200, validProfile));

    const result = await fetchAuthSession();

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.user?.name).toBe('裕貴 杉田');
  });

  // 401 / 403 に加え、ユーザー削除済み (404) のように時間をおいても
  // 直らないものは「トークンが無効」側に寄せる。
  // unavailable にするとトークンが永久に残り、全 API に添付され続ける
  it.each([400, 401, 403, 404, 422])(
    '%i は unauthenticated を返す',
    async (status) => {
      createApiRequest.mockResolvedValue(respond(status));

      expect((await fetchAuthSession()).status).toBe('unauthenticated');
    },
  );

  // ここが本件の回帰テスト。サーバが一時的に落ちただけでトークンを
  // 無効と判定すると、ログイン直後に理由なく強制ログアウトされる
  it.each([408, 429, 500, 502, 503])(
    '%i は unavailable を返す',
    async (status) => {
      createApiRequest.mockResolvedValue(respond(status));

      const result = await fetchAuthSession();

      expect(result.status).toBe('unavailable');
      expect(result.status === 'unavailable' && result.statusCode).toBe(status);
    },
  );

  it('通信失敗・タイムアウトは statusCode 無しの unavailable', async () => {
    createApiRequest.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetchAuthSession();

    // HTTP ステータスが存在しないことを statusCode の不在で表す
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('リダイレクトされた 200 は認証済みとみなさない', async () => {
    const hijacked = respond(200, validProfile);
    Object.defineProperty(hijacked, 'redirected', { value: true });
    createApiRequest.mockResolvedValue(hijacked);

    // 前段のプロキシに攫われた応答。API の答えではないので ok にしてはいけない
    expect((await fetchAuthSession()).status).toBe('unavailable');
  });

  it('200 だが本文が壊れていても認証は有効扱いにする', async () => {
    createApiRequest.mockResolvedValue(respond(200, 'not json'));

    const result = await fetchAuthSession();

    // ここで unauthenticated を返すと、API の一時的な応答形不良だけで
    // 強制ログアウトになる
    expect(result).toEqual({ status: 'ok', user: undefined });
  });

  it('200 でも必須項目が欠けていれば user は undefined', async () => {
    createApiRequest.mockResolvedValue(respond(200, { id: 2 }));

    expect(await fetchAuthSession()).toEqual({
      status: 'ok',
      user: undefined,
    });
  });
});

describe('resolveAuthState', () => {
  it('ok なら認証済みにし、トークンは残す', () => {
    expect(resolveAuthState({ status: 'ok', user: validProfile })).toEqual({
      isAuthenticated: true,
      discardToken: false,
      user: validProfile,
      unverified: false,
    });
  });

  it('unauthenticated ならトークンを破棄する', () => {
    expect(resolveAuthState({ status: 'unauthenticated' })).toEqual({
      isAuthenticated: false,
      discardToken: true,
      unverified: false,
    });
  });

  // 本件の核心。5xx や通信失敗でトークンを捨てると、
  // サーバの一時障害だけで強制ログアウトになる
  it('unavailable ではトークンを破棄せず、検証不能であることを伝える', () => {
    expect(
      resolveAuthState({ status: 'unavailable', statusCode: 500 }),
    ).toEqual({
      isAuthenticated: false,
      discardToken: false,
      unverified: true,
    });
  });
});

describe('toAuthUser', () => {
  it('必須項目が揃っていれば組み立てる', () => {
    expect(toAuthUser(validProfile)).toEqual(validProfile);
  });

  it('余計な項目は落として最小限に絞る', () => {
    // プロフィール全体をそのまま通すと bio やロールまで認証コンテキストに載る
    expect(toAuthUser({ ...validProfile, bio: 'x', role: 'admin' })).toEqual(
      validProfile,
    );
  });

  it.each([
    ['null', null],
    ['文字列', 'x'],
    ['id が数値でない', { id: '2', name: 'n', email: 'e' }],
    ['name が空', { id: 2, name: '', email: 'e' }],
    ['email が無い', { id: 2, name: 'n' }],
  ])('%s なら undefined(偽のユーザーを作らない)', (_label, raw) => {
    expect(toAuthUser(raw)).toBeUndefined();
  });

  it('avatar が文字列でなければ落とすが、user 自体は作る', () => {
    expect(toAuthUser({ ...validProfile, avatar: 123 })).toEqual({
      ...validProfile,
      avatar: undefined,
    });
  });
});
