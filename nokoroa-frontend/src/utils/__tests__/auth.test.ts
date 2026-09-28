import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// environment は node のまま、window / localStorage を vi.stubGlobal で
// スタブしてブラウザ経路(トークンの読み書きと Authorization ヘッダ付与)を検証する。
// jsdom を依存に足すほどの DOM 操作はしないため、この方式で十分。
// (delete による後始末は将来 jsdom テストが同居した時に本物の window を
//  消してしまうため、復元可能な stubGlobal / unstubAllGlobals を使う)
function installBrowserStub() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('window', { localStorage: localStorageStub });
  vi.stubGlobal('localStorage', localStorageStub);
}

describe('utils/auth (ブラウザ環境スタブ)', () => {
  beforeEach(() => {
    installBrowserStub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setToken → getToken で同じ値が返り、キーは jwt に保存される', async () => {
    const { getToken, setToken } = await import('@/utils/auth');
    setToken('token-abc');
    expect(getToken()).toBe('token-abc');
    expect(localStorage.getItem('jwt')).toBe('token-abc');
  });

  it('removeToken 後は null が返る', async () => {
    const { getToken, removeToken, setToken } = await import('@/utils/auth');
    setToken('token-abc');
    removeToken();
    expect(getToken()).toBeNull();
  });

  it('未保存なら getToken は null を返す', async () => {
    const { getToken } = await import('@/utils/auth');
    expect(getToken()).toBeNull();
  });

  it('exp が過去の JWT は掃除して null を返す', async () => {
    const { getToken, setToken } = await import('@/utils/auth');
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
    ).toString('base64url');
    setToken(`header.${payload}.sig`);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();
  });

  it('exp が未来の JWT はそのまま返す', async () => {
    const { getToken, setToken } = await import('@/utils/auth');
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    const token = `header.${payload}.sig`;
    setToken(token);
    expect(getToken()).toBe(token);
  });

  it('JWT として読めないトークンは有効扱いで返す(判定はサーバに委ねる)', async () => {
    const { getToken, setToken } = await import('@/utils/auth');
    setToken('not-a-jwt');
    expect(getToken()).toBe('not-a-jwt');
  });
});

describe('API_CONFIG.getAuthHeaders (ブラウザ環境スタブ)', () => {
  beforeEach(() => {
    installBrowserStub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('トークンがあれば Authorization: Bearer が付く', async () => {
    const { setToken } = await import('@/utils/auth');
    const { API_CONFIG } = await import('@/lib/apiConfig');
    setToken('token-xyz');
    const headers = API_CONFIG.getAuthHeaders() as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-xyz');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('トークンが無ければ Authorization ヘッダ自体が付かない', async () => {
    const { API_CONFIG } = await import('@/lib/apiConfig');
    const headers = API_CONFIG.getAuthHeaders() as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });
});
