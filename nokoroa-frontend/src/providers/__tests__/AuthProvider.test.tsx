// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSessionResult } from '@/lib/authSession';
import {
  AuthProvider,
  RegisterResult,
  useAuth,
} from '@/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  createApiRequest: vi.fn(),
  fetchAuthSession: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  navigatePush: vi.fn(),
}));

vi.mock('@/lib/apiConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiConfig')>()),
  createApiRequest: (...args: unknown[]) => mocks.createApiRequest(...args),
}));

vi.mock('@/lib/authSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authSession')>()),
  fetchAuthSession: () => mocks.fetchAuthSession(),
}));

vi.mock('@/utils/auth', () => ({
  getToken: () => mocks.getToken(),
  setToken: (token: string) => mocks.setToken(token),
  removeToken: () => mocks.removeToken(),
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: (m: string) => mocks.toastSuccess(m),
    error: (m: string) => mocks.toastError(m),
    info: (m: string) => mocks.toastInfo(m),
  },
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

vi.mock('@/hooks/useSmoothNavigation', () => ({
  useSmoothNavigation: () => ({ push: mocks.navigatePush }),
}));

vi.mock('swr', () => ({ mutate: vi.fn() }));

const VERIFIED: AuthSessionResult = {
  status: 'ok',
  user: { id: 2, name: '裕貴 杉田', email: 'user@example.com' },
};

const respond = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

/**
 * 呼ばれるたびに新しい Response を返す。
 * 同じインスタンスを返すと 2 回目の json() が body used already で throw し、
 * 実装とは無関係な失敗になる
 */
const respondWith = (status: number, body: unknown = {}) =>
  mocks.createApiRequest.mockImplementation(() =>
    Promise.resolve(respond(status, body)),
  );

/** Provider 配下から login / register を呼べるようにする */
let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return null;
}

const renderProvider = async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  // 起動時検証(トークン無しなので同期的に終わる)を流す
  await act(async () => {});
};

beforeEach(async () => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.getToken.mockReturnValue(null);
  await renderProvider();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('login', () => {
  it('検証が通れば認証済みにして成功を伝える', async () => {
    respondWith(200, { token: 'jwt' });
    mocks.fetchAuthSession.mockResolvedValue(VERIFIED);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await auth.login('a@example.com', 'pw');
    });

    expect(ok).toBe(true);
    expect(mocks.setToken).toHaveBeenCalledWith('jwt');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ログインしました');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.name).toBe('裕貴 杉田');
  });

  // 検証できていないのに成功を名乗ると、次の読み込みで未認証に覆る
  it.each([
    ['トークンが拒否された', { status: 'unauthenticated' } as const],
    ['検証できなかった', { status: 'unavailable', reason: 'server' } as const],
  ])('%s なら失敗を返し、トークンも state も残さない', async (_l, session) => {
    respondWith(200, { token: 'jwt' });
    mocks.fetchAuthSession.mockResolvedValue(session);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await auth.login('a@example.com', 'pw');
    });

    expect(ok).toBe(false);
    expect(mocks.removeToken).toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeUndefined();
  });

  // 失敗側の state リセットは、未認証から始めると初期値と区別が付かない。
  // ログイン中から失敗させて初めて「前のユーザーの表示が残る」を検知できる
  it('ログイン中に別アカウントのログインが失敗したら、前の表示を残さない', async () => {
    respondWith(200, { token: 'jwt' });
    mocks.fetchAuthSession.mockResolvedValue(VERIFIED);
    await act(async () => {
      await auth.login('a@example.com', 'pw');
    });
    expect(auth.isAuthenticated).toBe(true);

    mocks.fetchAuthSession.mockResolvedValue({
      status: 'unavailable',
      reason: 'server',
    });
    await act(async () => {
      await auth.login('b@example.com', 'pw');
    });

    // トークンは b のものに差し替わっているため、state を残すと
    // 「a の表示のまま b のトークンで API を叩く」状態になる
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeUndefined();
  });

  // 入力をやり直しても 5xx は解消しないため、資格情報のせいにしない
  it('ログイン API の 5xx は資格情報の誤りとして案内しない', async () => {
    respondWith(503);

    await act(async () => {
      await auth.login('a@example.com', 'pw');
    });

    expect(mocks.toastError.mock.calls[0][0]).not.toContain(
      'メールアドレスとパスワードを確認',
    );
  });
});

describe('register', () => {
  const signupOk = () => {
    mocks.createApiRequest.mockImplementation((endpoint: string) =>
      Promise.resolve(
        endpoint === '/users/signup'
          ? respond(201, { id: 3 })
          : respond(200, { token: 'jwt' }),
      ),
    );
  };

  it('登録と自動ログインが通れば signed-in を返す', async () => {
    signupOk();
    mocks.fetchAuthSession.mockResolvedValue(VERIFIED);

    let result: RegisterResult | undefined;
    await act(async () => {
      result = await auth.register('n', 'a@example.com', 'pw');
    });

    expect(result).toBe('signed-in');
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'アカウントを作成しました！',
    );
  });

  // アカウントは作成済みなので failed を返してはいけない。
  // ユーザーが登録失敗と理解して再登録すると、メール重複で行き止まりになる
  it.each([
    ['トークンが拒否された', { status: 'unauthenticated' } as const],
    ['検証できなかった', { status: 'unavailable', reason: 'server' } as const],
  ])(
    '自動ログインが %s でも registered を返し、作成済みであることを伝える',
    async (_l, session) => {
      signupOk();
      mocks.fetchAuthSession.mockResolvedValue(session);

      let result: RegisterResult | undefined;
      await act(async () => {
        result = await auth.register('n', 'a@example.com', 'pw');
      });

      expect(result).toBe('registered');
      expect(mocks.toastInfo.mock.calls[0][0]).toContain(
        'アカウントを作成しました',
      );
      // 自動ログインの失敗通知は出さない。登録できた事実と併せて 1 つで伝える
      expect(mocks.toastError).not.toHaveBeenCalled();
    },
  );

  // 検証できない場合はログイン画面でも同じ検証で弾かれるため、そちらへ送らない
  it('検証できなかった場合はログイン画面へ案内しない', async () => {
    signupOk();
    mocks.fetchAuthSession.mockResolvedValue({
      status: 'unavailable',
      reason: 'server',
    });

    await act(async () => {
      await auth.register('n', 'a@example.com', 'pw');
    });

    expect(mocks.toastInfo.mock.calls[0][0]).not.toContain('ログイン画面');
  });

  // 重複を「入力内容の誤り」と案内すると、別アドレスでの二重登録に誘導する
  it('メール重複(409)は既に登録済みであることを伝える', async () => {
    respondWith(409);

    let result: RegisterResult | undefined;
    await act(async () => {
      result = await auth.register('n', 'a@example.com', 'pw');
    });

    expect(result).toBe('failed');
    expect(mocks.toastError.mock.calls[0][0]).toContain('既に登録されています');
  });
});

describe('起動時検証', () => {
  const renderWithToken = async (session: AuthSessionResult) => {
    cleanup();
    mocks.getToken.mockReturnValue('stored');
    mocks.fetchAuthSession.mockResolvedValue(session);
    await renderProvider();
  };

  it('検証が通れば認証済みにする', async () => {
    await renderWithToken(VERIFIED);

    expect(auth.isAuthenticated).toBe(true);
    expect(mocks.removeToken).not.toHaveBeenCalled();
  });

  it('トークンが無効なら破棄する', async () => {
    await renderWithToken({ status: 'unauthenticated' });

    expect(auth.isAuthenticated).toBe(false);
    expect(mocks.removeToken).toHaveBeenCalled();
  });

  // 本件の回帰テスト。サーバの一時障害でトークンを捨てると、
  // 復旧後も再ログインが必要になる
  it('検証できなかった場合はトークンを残し、理由を伝える', async () => {
    await renderWithToken({ status: 'unavailable', reason: 'server' });

    expect(mocks.removeToken).not.toHaveBeenCalled();
    expect(auth.isAuthenticated).toBe(false);
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('isLoading は必ず下りる', async () => {
    await renderWithToken({ status: 'unavailable', reason: 'network' });

    expect(auth.isLoading).toBe(false);
  });
});
