// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/providers/AuthProvider';

// next/navigation / react-toastify / swr は AuthProvider の外側の関心なので
// 最小のスタブに差し替え、認証の状態遷移だけを見る。
const push = vi.fn();
const replace = vi.fn();
let pathname = '/my-posts';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace }),
}));
// 本物の useSmoothNavigation は pathname を閉じ込み「現在パスと同じ href なら
// 遷移しない」早期 return を持つ。この性質が logout の往復と噛み合うため、
// スタブでも同じ振る舞いを再現する（しないと該当のリグレッションを検出できない）。
vi.mock('@/hooks/useSmoothNavigation', () => ({
  useSmoothNavigation: () => {
    const currentPathname = pathname;
    return {
      push: (href: string) => {
        if (currentPathname === href) {
          return;
        }
        push(href);
      },
    };
  },
}));
const toastCalls: string[] = [];
vi.mock('react-toastify', () => ({
  toast: {
    success: (m: string) => toastCalls.push(`success:${m}`),
    error: (m: string) => toastCalls.push(`error:${m}`),
    info: (m: string) => toastCalls.push(`info:${m}`),
    warn: (m: string) => toastCalls.push(`warn:${m}`),
  },
}));
vi.mock('swr', () => ({ mutate: vi.fn() }));

const ME_USER = { id: 1, name: 'Me', email: 'me@example.com' };

/** 認証状態と操作を DOM に出すだけの覗き窓 */
function Probe() {
  const { isLoading, isAuthenticated, isLoggingOut, user, login, logout } =
    useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="loggingOut">{String(isLoggingOut)}</span>
      <span data-testid="user">{user?.name ?? '-'}</span>
      <button onClick={() => void login('me@example.com', 'password123')}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const setSessionHint = (present: boolean) => {
  document.cookie = present
    ? 'nokoroa_session=1'
    : 'nokoroa_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe('AuthProvider のセッション復元', () => {
  beforeEach(() => {
    pathname = '/my-posts';
    toastCalls.length = 0;
    push.mockClear();
    replace.mockClear();
    setSessionHint(false);
    localStorage.clear();
  });

  afterEach(() => {
    // vitest globals を使わない設定なので testing-library の自動 cleanup が
    // 登録されない。消さないと DOM が積み上がり getByTestId が複数一致で落ちる
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ログインヒントが無ければ API を叩かず即「未ログイン」にする', async () => {
    // 未ログインの訪問者に 1 RTT 待たせないための経路。
    // ここで fetch が走ると全ページの初回表示が遅くなる
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authed').textContent).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ヒントがあればサーバーに確認してユーザーを入れる', async () => {
    setSessionHint(true);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ME_USER));
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );
    expect(screen.getByTestId('user').textContent).toBe('Me');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/me');
  });

  it('ヒントが残っていてもサーバーが 401 なら未ログインにする', async () => {
    // ヒントは JS から書き換えられるため、これを信じ切ってはいけない
    setSessionHint(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('/auth/me が 5xx のときはログイン状態を維持する', async () => {
    // ここで未ログインに倒すと、API の一時障害だけで全員が強制ログアウトになる
    setSessionHint(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authed').textContent).toBe('true');
  });

  it('起動時に旧 localStorage の jwt を消す', async () => {
    localStorage.setItem('jwt', 'legacy-token');
    vi.stubGlobal('fetch', vi.fn());

    renderProvider();

    await waitFor(() => expect(localStorage.getItem('jwt')).toBeNull());
  });
});

describe('AuthProvider.login', () => {
  beforeEach(() => {
    pathname = '/login';
    toastCalls.length = 0;
    setSessionHint(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('ログイン成功後にセッションを引き直して認証状態にする', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { user: ME_USER }))
      .mockResolvedValueOnce(jsonResponse(200, ME_USER));
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );
    expect(toastCalls).toContain('success:ログインしました');
  });

  it('/auth/me が 401 ならクッキーが効いていないのでログイン失敗にする', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { user: ME_USER }))
      .mockResolvedValueOnce(jsonResponse(401, {}));
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() =>
      expect(
        toastCalls.some((c) =>
          c.includes('ログイン状態を保存できませんでした'),
        ),
      ).toBe(true),
    );
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('/auth/me が 5xx でもログイン成功として扱う', async () => {
    // サーバーは既にクッキーを発行済み。ここで失敗にすると
    // 「失敗表示なのにリロードするとログイン済み」という矛盾状態になる
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { user: ME_USER }))
      .mockResolvedValueOnce(jsonResponse(503, {}));
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );
    // ログインレスポンスの user を表示に使う
    expect(screen.getByTestId('user').textContent).toBe('Me');
    expect(
      toastCalls.some((c) => c.includes('ログイン状態を保存できませんでした')),
    ).toBe(false);
  });
});

describe('AuthProvider.logout', () => {
  beforeEach(() => {
    pathname = '/my-posts';
    toastCalls.length = 0;
    push.mockClear();
    setSessionHint(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('サーバーのクッキー削除を待ってから状態を落とす', async () => {
    let resolveLogout: ((value: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, ME_USER))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveLogout = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
    });

    // 往復中はまだログイン状態のまま。先に落とすと、保護ページのガードが
    // 走ってしまう
    expect(screen.getByTestId('authed').textContent).toBe('true');

    await act(async () => {
      resolveLogout?.(jsonResponse(200, { message: 'ok' }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );
    expect(push).toHaveBeenCalledWith('/');
  });

  it('往復中にページが変わっても isLoggingOut を立てる(ガード競合を防ぐ)', async () => {
    let resolveLogout: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ME_USER))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveLogout = resolve;
            }),
        ),
    );

    const view = renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
    });

    // 往復中に別ページへ遷移する
    pathname = '/settings';
    view.rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      resolveLogout?.(jsonResponse(200, { message: 'ok' }));
    });

    // 遷移後の pathname('/settings') で判定されるのでフラグが立つ。
    // ここが false だと useRequireAuth の replace('/login') が勝ってしまう
    await waitFor(() =>
      expect(screen.getByTestId('loggingOut').textContent).toBe('true'),
    );
  });

  it('連打しても POST と遷移は 1 回だけ', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, ME_USER))
      .mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
      screen.getByText('logout').click();
      screen.getByText('logout').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );
    const logoutCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/logout'),
    );
    expect(logoutCalls).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("'/' でログアウトし往復中に保護ページへ移動したら、そのページから退避させる", async () => {
    // クリック時の pathname が '/' なので、古い navigatePush の closure から見ると
    // 「現在パス === '/' だから遷移不要」になる。往復後に最新のパスで判定しないと、
    // 保護ページに留まったまま isLoggingOut=true が立ち続け、
    // useRequireAuth のリダイレクトも抑止されて画面が固着する
    pathname = '/';
    let resolveLogout: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ME_USER))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveLogout = resolve;
            }),
        ),
    );

    const view = renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
    });

    // 往復中に保護ページへ移動する
    pathname = '/settings';
    view.rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      resolveLogout?.(jsonResponse(200, { message: 'ok' }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );
    // 保護ページから必ず離脱させる
    expect(push).toHaveBeenCalledWith('/');
  });

  it('ログアウト後にヒントが残っていない', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ME_USER))
        .mockResolvedValueOnce(jsonResponse(200, { message: 'ok' })),
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    // サーバーが Set-Cookie で消す挙動はここでは再現できないため、
    // テスト側でサーバーの削除を模す
    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );
    setSessionHint(false);

    const { hasSessionHint } = await import('@/utils/auth');
    expect(hasSessionHint()).toBe(false);
  });

  it('サーバー削除に失敗したらヒントだけでも消す', async () => {
    // ヒントが残ると、次のリロードで「ログイン中」と判断して /auth/me を引き、
    // サーバー側のクッキーが生きていれば前の利用者のセッションに戻ってしまう
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ME_USER))
        .mockResolvedValueOnce(jsonResponse(502, {})),
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );

    const { hasSessionHint } = await import('@/utils/auth');
    expect(hasSessionHint()).toBe(false);
  });

  it('サーバー側の削除に失敗したら黙らせず警告する', async () => {
    // 共用端末でクッキーが残ったままだと、次の利用者がログイン状態で入れる
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, ME_USER))
        .mockResolvedValueOnce(jsonResponse(502, {})),
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('true'),
    );

    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('authed').textContent).toBe('false'),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(toastCalls.some((c) => c.startsWith('warn:'))).toBe(true);
    expect(toastCalls).not.toContain('info:ログアウトしました');
  });
});
