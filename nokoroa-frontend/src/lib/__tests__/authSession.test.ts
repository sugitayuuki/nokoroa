import { beforeEach, describe, expect, it, vi } from 'vitest';

const createApiRequest = vi.fn();

vi.mock('@/lib/apiConfig', () => ({
  API_CONFIG: { endpoints: { userProfile: '/users/profile' } },
  createApiRequest: (...args: unknown[]) => createApiRequest(...args),
}));

const { fetchAuthSession, toAuthUser } = await import('@/lib/authSession');

/** fetch の戻りを最小限で模す */
const respond = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new Error('invalid json');
    return body;
  },
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
  it('200 ならユーザーを返す', async () => {
    createApiRequest.mockResolvedValue(respond(200, validProfile));

    const result = await fetchAuthSession();

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.user?.name).toBe('裕貴 杉田');
  });

  // 401 / 403 だけが「トークンが無効」。呼び出し側はこれを見てトークンを捨てる
  it.each([401, 403])('%i は unauthenticated を返す', async (status) => {
    createApiRequest.mockResolvedValue(respond(status, {}));

    expect((await fetchAuthSession()).status).toBe('unauthenticated');
  });

  // ここが本件の回帰テスト。
  // 以前は非 2xx を一括で「無効」とみなしてトークンを削除していたため、
  // バックエンドが 500 を返しただけでログイン直後に強制ログアウトされていた。
  it.each([500, 502, 503])(
    '%i は unavailable を返す(トークンは無効ではない)',
    async (status) => {
      createApiRequest.mockResolvedValue(respond(status, {}));

      const result = await fetchAuthSession();

      expect(result.status).toBe('unavailable');
      expect(result.status === 'unavailable' && result.statusCode).toBe(status);
    },
  );

  it('通信失敗は unavailable を返す', async () => {
    createApiRequest.mockRejectedValue(new TypeError('Failed to fetch'));

    expect((await fetchAuthSession()).status).toBe('unavailable');
  });

  it('200 だが本文が壊れていても認証は有効扱いにする', async () => {
    createApiRequest.mockResolvedValue(respond(200));

    const result = await fetchAuthSession();

    // ここで unauthenticated を返すとトークンが消え、
    // API の一時的な応答形不良だけで強制ログアウトになる
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.user).toBeUndefined();
  });

  it('200 でも必須項目が欠けていれば user は undefined', async () => {
    createApiRequest.mockResolvedValue(respond(200, { id: 2 }));

    const result = await fetchAuthSession();

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.user).toBeUndefined();
  });
});

describe('toAuthUser', () => {
  it('必須項目が揃っていれば組み立てる', () => {
    expect(toAuthUser(validProfile)).toEqual(validProfile);
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

  it('avatar が文字列でなければ undefined に落とす', () => {
    expect(toAuthUser({ ...validProfile, avatar: 123 })?.avatar).toBeUndefined();
  });
});
