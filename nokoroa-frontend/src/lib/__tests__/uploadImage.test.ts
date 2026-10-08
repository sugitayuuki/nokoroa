import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// fetch をモックして uploadPostImage の契約(URL / credentials / 401 文言 / throw)を固定する。
// 認証は httpOnly クッキーなので、テスト側でトークンを用意する必要はない。
const makeFile = () => new File(['dummy'], 'photo.png', { type: 'image/png' });

describe('uploadPostImage', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('成功時は url を返し、正しいエンドポイントを叩く', async () => {
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

  it('認証クッキーを送る', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://cdn.example/photo.png' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await uploadPostImage(makeFile());

    // credentials を落とすと未ログイン扱いになり、常に 401 になる
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });

  it('Content-Type を指定しない(multipart の boundary を壊さない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://cdn.example/photo.png' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { uploadPostImage } = await import('@/lib/uploadImage');

    await uploadPostImage(makeFile());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toBeUndefined();
  });

  it('401 は再ログインを促す文言で throw する', async () => {
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
