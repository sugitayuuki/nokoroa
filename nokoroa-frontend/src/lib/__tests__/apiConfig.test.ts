import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  API_CONFIG,
  API_FETCH_OPTIONS,
  createApiRequest,
  createFormDataRequest,
} from '@/lib/apiConfig';

const { endpoints, buildUrl } = API_CONFIG;

describe('API_CONFIG.BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('NEXT_PUBLIC_API_URL 未設定なら localhost:4000 に /api を付ける', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.resetModules();
    const fresh = await import('@/lib/apiConfig');
    expect(fresh.API_CONFIG.BASE_URL).toBe('http://localhost:4000/api');
  });

  it('NEXT_PUBLIC_API_URL が設定されていればそのオリジンに /api を付ける', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://nokoroa.com');
    vi.resetModules();
    const fresh = await import('@/lib/apiConfig');
    expect(fresh.API_CONFIG.BASE_URL).toBe('https://nokoroa.com/api');
  });

  it('バックエンドの setGlobalPrefix("api") と一致する /api で終わる', () => {
    expect(API_CONFIG.BASE_URL.endsWith('/api')).toBe(true);
  });

  it('末尾にスラッシュを残さない (buildUrl での二重スラッシュを防ぐ)', () => {
    expect(API_CONFIG.BASE_URL.endsWith('/')).toBe(false);
  });
});

describe('API_CONFIG.buildUrl', () => {
  it('BASE_URL とエンドポイントを連結する', () => {
    expect(buildUrl('/posts')).toBe(`${API_CONFIG.BASE_URL}/posts`);
  });

  it('スラッシュが重複しない', () => {
    expect(buildUrl('/posts')).not.toContain('/api//');
    expect(buildUrl(endpoints.postById('12'))).not.toContain('//posts');
  });

  it('クエリ文字列付きのエンドポイントをそのまま保持する', () => {
    expect(buildUrl('/posts/search?q=京都&page=2')).toBe(
      `${API_CONFIG.BASE_URL}/posts/search?q=京都&page=2`,
    );
  });

  it('空文字列なら BASE_URL そのものを返す', () => {
    expect(buildUrl('')).toBe(API_CONFIG.BASE_URL);
  });

  it('組み立てた URL がパースできる絶対 URL になる', () => {
    const url = new URL(buildUrl(endpoints.followStats('7')));
    expect(url.pathname).toBe('/api/follows/7/stats');
  });
});

describe('API_CONFIG.endpoints', () => {
  const staticEntries = Object.entries(endpoints).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  const dynamicEntries = Object.entries(endpoints).filter(
    (entry): entry is [string, (id: string) => string] =>
      typeof entry[1] === 'function',
  );

  it('定義は文字列か ID を受け取る関数のみで、他の型が混ざらない', () => {
    // オブジェクトのネストなどが混ざると buildUrl に渡した時点で
    // "[object Object]" が URL に入り、404 の原因が追いにくくなる
    expect(staticEntries.length + dynamicEntries.length).toBe(
      Object.keys(endpoints).length,
    );
    expect(staticEntries.length).toBeGreaterThan(0);
    expect(dynamicEntries.length).toBeGreaterThan(0);
  });

  it('固定エンドポイントは必ず / で始まる', () => {
    for (const [name, path] of staticEntries) {
      expect(path.startsWith('/'), `${name} が / で始まっていない`).toBe(true);
    }
  });

  it('ID 付きエンドポイントも必ず / で始まる', () => {
    for (const [name, build] of dynamicEntries) {
      expect(build('1').startsWith('/'), `${name} が / で始まっていない`).toBe(
        true,
      );
    }
  });

  it('ID 付きエンドポイントは渡した ID をパスに埋め込む', () => {
    for (const [name, build] of dynamicEntries) {
      expect(build('42'), `${name} に ID が入っていない`).toContain('42');
    }
  });

  it('主要なパスがバックエンドのルートと一致する', () => {
    expect(endpoints.login).toBe('/auth/login');
    expect(endpoints.logout).toBe('/auth/logout');
    expect(endpoints.me).toBe('/auth/me');
    expect(endpoints.signup).toBe('/users/signup');
    expect(endpoints.googleAuth).toBe('/auth/google');
    expect(endpoints.posts).toBe('/posts');
    expect(endpoints.search).toBe('/posts/search');
    expect(endpoints.userProfile).toBe('/users/profile');
  });

  it('ID 付きパスを組み立てる', () => {
    expect(endpoints.postById('12')).toBe('/posts/12');
    expect(endpoints.userById('3')).toBe('/users/3');
    expect(endpoints.followUser('3')).toBe('/follows/3');
    expect(endpoints.checkFollow('3')).toBe('/follows/check/3');
    expect(endpoints.userFollowers('3')).toBe('/follows/3/followers');
    expect(endpoints.checkFavorite('12')).toBe('/favorites/check/12');
    expect(endpoints.favoriteStats('12')).toBe('/favorites/stats/12');
    expect(endpoints.bookmarkPost('12')).toBe('/bookmarks/12');
  });

  it('/users 配下の follow と /follows 配下の follow を混同しない', () => {
    // 2 系統のフォロー API が併存しているため、取り違えると 404 になる
    expect(endpoints.follow('3')).toBe('/users/3/follow');
    expect(endpoints.followUser('3')).not.toBe(endpoints.follow('3'));
    expect(endpoints.followers('3')).toBe('/users/3/followers');
    expect(endpoints.userFollowers('3')).not.toBe(endpoints.followers('3'));
  });

  it('空の ID では不正なパスになる(呼び出し側で弾く必要がある既知の性質)', () => {
    expect(endpoints.postById('')).toBe('/posts/');
    expect(endpoints.followStats('')).toBe('/follows//stats');
  });
});

describe('認証の渡し方', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('トークンをヘッダに載せる仕組みは残っていない', () => {
    // JWT は httpOnly クッキーで渡すため、フロントがトークンを読んで
    // Authorization を組み立てる経路は廃止した
    expect(API_CONFIG).not.toHaveProperty('getAuthHeaders');
    expect(API_CONFIG).not.toHaveProperty('getFormDataAuthHeaders');
  });

  it('API_FETCH_OPTIONS は認証クッキーを送る設定になっている', () => {
    expect(API_FETCH_OPTIONS.credentials).toBe('include');
  });

  it('createApiRequest は credentials と Content-Type を付ける', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await createApiRequest(endpoints.me);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(buildUrl(endpoints.me));
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
    });
  });

  it('呼び出し側は method を指定できる', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await createApiRequest(endpoints.logout, { method: 'POST' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });

  it('呼び出し側は credentials を上書きできない', async () => {
    // 上書きできると、そのリクエストだけ無認証で飛んで
    // 「401 か公開データのみ」という原因の見えない壊れ方をする
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await createApiRequest(endpoints.me, { credentials: 'omit' });
    await createApiRequest(endpoints.me, { credentials: undefined });

    for (const call of fetchMock.mock.calls) {
      const [, init] = call as [string, RequestInit];
      expect(init.credentials).toBe('include');
    }
  });

  it('createFormDataRequest は credentials を付け Content-Type を付けない', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await createFormDataRequest(endpoints.uploadPostImage, new FormData());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    // multipart の boundary を壊さないため指定しない
    expect(init.headers).toBeUndefined();
  });
});
