import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// environment は node のまま、window / localStorage を vi.stubGlobal で
// 差し替える。モジュールは isBrowser() の判定後に読み込ませたいので動的 import。
function stubBrowser() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  vi.stubGlobal('window', { localStorage: localStorageStub });
  vi.stubGlobal('localStorage', localStorageStub);
  return store;
}

describe('purgeLegacyStoredToken', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = stubBrowser();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('旧実装が localStorage に残した jwt を削除する', async () => {
    localStorage.setItem('jwt', 'legacy-token');
    const { purgeLegacyStoredToken } = await import('@/utils/auth');

    purgeLegacyStoredToken();

    expect(localStorage.getItem('jwt')).toBeNull();
  });

  it('jwt 以外のキーは消さない', async () => {
    localStorage.setItem('jwt', 'legacy-token');
    localStorage.setItem('nokoroa:searchHistory', '["京都"]');
    const { purgeLegacyStoredToken } = await import('@/utils/auth');

    purgeLegacyStoredToken();

    expect(localStorage.getItem('nokoroa:searchHistory')).toBe('["京都"]');
  });

  it('保存されていなくてもエラーにならない', async () => {
    const { purgeLegacyStoredToken } = await import('@/utils/auth');

    expect(() => purgeLegacyStoredToken()).not.toThrow();
    expect(store.size).toBe(0);
  });

  it('localStorage が使えない環境でも例外を投げない', async () => {
    // プライベートモード等で removeItem が throw するブラウザがある。
    // ここで落とすとアプリの初期化全体が止まる
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    const { purgeLegacyStoredToken } = await import('@/utils/auth');

    expect(() => purgeLegacyStoredToken()).not.toThrow();
  });
});

describe('purgeLegacyStoredToken (window が無い SSR 環境)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('window が無ければ何もしない', async () => {
    expect(typeof window).toBe('undefined');
    const { purgeLegacyStoredToken } = await import('@/utils/auth');

    expect(() => purgeLegacyStoredToken()).not.toThrow();
  });
});

describe('トークン保存 API の廃止', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getToken / setToken / removeToken は公開しない', async () => {
    // 認証は httpOnly クッキーに移したため、フロントがトークンを
    // 保持する経路は残っていない(残すと XSS で盗める面が復活する)
    const authModule = await import('@/utils/auth');

    expect(authModule).not.toHaveProperty('getToken');
    expect(authModule).not.toHaveProperty('setToken');
    expect(authModule).not.toHaveProperty('removeToken');
  });
});
