import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG } from '@/lib/apiConfig';
import {
  decideAuthAction,
  fetchAuthSession,
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

afterEach(() => {
  vi.useRealTimers();
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

  // AbortSignal.timeout は Safari 16+ が必要で、Next の既定ターゲット
  // (safari 12) を外れる。使うと未対応環境で検証が常に失敗する
  it('AbortSignal.timeout が無い環境でも検証できる', async () => {
    const original = AbortSignal.timeout;
    // @ts-expect-error 互換性の退行を検知するため意図的に欠落させる
    delete AbortSignal.timeout;
    createApiRequest.mockResolvedValue(respond(200, validProfile));

    try {
      expect((await fetchAuthSession()).status).toBe('ok');
    } finally {
      AbortSignal.timeout = original;
    }
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
    '%i はトークンが無効と判定する',
    async (status) => {
      createApiRequest.mockResolvedValue(respond(status));

      expect((await fetchAuthSession()).status).toBe('unauthenticated');
    },
  );

  // サーバが一時的に落ちただけでトークンを無効と判定すると、
  // ログイン直後に理由なく強制ログアウトされる
  it.each([408, 429, 500, 502, 503])(
    '%i は検証不能(server)として扱う',
    async (status) => {
      createApiRequest.mockResolvedValue(respond(status));

      expect(await fetchAuthSession()).toEqual({
        status: 'unavailable',
        reason: 'server',
        statusCode: status,
      });
    },
  );

  it('到達できなければ network として扱う', async () => {
    createApiRequest.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await fetchAuthSession()).toEqual({
      status: 'unavailable',
      reason: 'network',
    });
  });

  // 到達はしているので、ユーザーの通信環境のせいにしてはいけない
  it('応答が無いまま上限に達したら timeout として打ち切る', async () => {
    vi.useFakeTimers();
    createApiRequest.mockImplementation(
      (_endpoint: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const pending = fetchAuthSession();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toEqual({ status: 'unavailable', reason: 'timeout' });
  });

  it('リダイレクトされた 200 は認証済みとみなさない', async () => {
    const hijacked = respond(200, validProfile);
    Object.defineProperty(hijacked, 'redirected', { value: true });
    createApiRequest.mockResolvedValue(hijacked);

    // 前段のプロキシに攫われた応答。API の答えではないので ok にしてはいけない
    expect(await fetchAuthSession()).toEqual({
      status: 'unavailable',
      reason: 'intercepted',
    });
  });

  it('200 だが本文が壊れていても認証は有効扱いにする', async () => {
    createApiRequest.mockResolvedValue(respond(200, 'not json'));

    // ここで unauthenticated を返すと、API の一時的な応答形不良だけで
    // 強制ログアウトになる
    expect(await fetchAuthSession()).toEqual({
      status: 'ok',
      user: undefined,
    });
  });

  it('200 でも必須項目が欠けていれば user は undefined', async () => {
    createApiRequest.mockResolvedValue(respond(200, { id: 2 }));

    expect(await fetchAuthSession()).toEqual({
      status: 'ok',
      user: undefined,
    });
  });
});

describe('decideAuthAction', () => {
  it('ok なら認証を受け入れる', () => {
    expect(decideAuthAction({ status: 'ok', user: validProfile })).toEqual({
      action: 'accept',
      user: validProfile,
    });
  });

  it('unauthenticated ならトークンを破棄する', () => {
    expect(decideAuthAction({ status: 'unauthenticated' })).toEqual({
      action: 'discard',
    });
  });

  // 5xx や通信失敗でトークンを捨てると、サーバの一時障害だけで
  // 強制ログアウトになる
  it.each([
    [
      'server',
      { status: 'unavailable', reason: 'server', statusCode: 500 } as const,
    ],
    ['timeout', { status: 'unavailable', reason: 'timeout' } as const],
    ['network', { status: 'unavailable', reason: 'network' } as const],
    ['intercepted', { status: 'unavailable', reason: 'intercepted' } as const],
  ])('検証不能(%s)ではトークンを残す', (_label, result) => {
    expect(decideAuthAction(result)).toEqual({ action: 'retain' });
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
