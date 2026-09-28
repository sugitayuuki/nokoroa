import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// environment は node のまま、window / localStorage を最小スタブして
// ブラウザ経路(トークンの読み書きと Authorization ヘッダ付与)を検証する。
// jsdom を依存に足すほどの DOM 操作はしないため、この方式で十分。
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
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: localStorageStub },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageStub,
    configurable: true,
    writable: true,
  });
}

function removeBrowserStub() {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
}

describe('utils/auth (ブラウザ環境スタブ)', () => {
  beforeEach(() => {
    installBrowserStub();
  });
  afterEach(() => {
    removeBrowserStub();
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
});

describe('API_CONFIG.getAuthHeaders (ブラウザ環境スタブ)', () => {
  beforeEach(() => {
    installBrowserStub();
  });
  afterEach(() => {
    removeBrowserStub();
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
