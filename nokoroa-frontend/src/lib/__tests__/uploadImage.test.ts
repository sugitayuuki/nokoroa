import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// auth.test.ts と同じ方式で window / localStorage をスタブし、
// fetch もモックして uploadPostImage の契約(URL / 401 文言 / throw)を固定する。
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

const makeFile = () => new File(['dummy'], 'photo.png', { type: 'image/png' });

describe('uploadPostImage', () => {
  beforeEach(() => {
    installBrowserStub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('トークンが無ければ通信せずに throw する', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await expect(uploadPostImage(makeFile())).rejects.toThrow(
      '認証トークンが見つかりません',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('成功時は url を返し、正しいエンドポイントを叩く', async () => {
    localStorage.setItem('jwt', 'token-abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://cdn.example/photo.png' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await expect(uploadPostImage(makeFile())).resolves.toBe(
      'https://cdn.example/photo.png',
    );
    const [url] = fetchMock.mock.calls[0] as [string];
    // 旧実装は存在しない /upload を叩いて常に 404 だった。正しいパスを固定する
    expect(url.endsWith('/api/posts/upload-image')).toBe(true);
  });

  it('401 は再ログインを促す文言で throw する', async () => {
    localStorage.setItem('jwt', 'token-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      }),
    );
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await expect(uploadPostImage(makeFile())).rejects.toThrow(
      '認証が必要です。再度ログインしてください。',
    );
  });

  it('その他の失敗はサーバメッセージを優先して throw する', async () => {
    localStorage.setItem('jwt', 'token-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'サーバが混み合っています' }),
      }),
    );
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await expect(uploadPostImage(makeFile())).rejects.toThrow(
      'サーバが混み合っています',
    );
  });
});
