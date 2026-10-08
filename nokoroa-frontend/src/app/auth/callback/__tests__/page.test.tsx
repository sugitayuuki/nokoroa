// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthCallbackPage from '@/app/auth/callback/page';

// next/navigation / react-toastify / AuthProvider は着地ページの外側の関心なので
// 最小のスタブに差し替え、「着地処理が何回走るか」だけを見る。
//
// router は**毎回同じオブジェクト**を返す。本物の useRouter() は
// AppRouterContext 経由のモジュール単一インスタンスで参照が変わらないため。
// 毎回新しく作ると effect の依存が常に無効化され、「依存が変わっても 1 回」を
// 検証しているつもりで、ただの参照不安定を測ることになる
// (そのスタブでは依存を絞っただけの別実装まで落ちてしまう)。
const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

// 兄弟テスト(providers/__tests__/AuthProvider.test.tsx)と同じ 4 メソッドを揃える。
const toastCalls: string[] = [];
vi.mock('react-toastify', () => ({
  toast: {
    success: (m: string) => toastCalls.push(`success:${m}`),
    error: (m: string) => toastCalls.push(`error:${m}`),
    info: (m: string) => toastCalls.push(`info:${m}`),
    warn: (m: string) => toastCalls.push(`warn:${m}`),
  },
}));

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user?: { id: number; name: string; email: string };
};
let authState: AuthState = { isLoading: true, isAuthenticated: false };
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => authState,
}));

beforeEach(() => {
  toastCalls.length = 0;
  replace.mockClear();
  authState = { isLoading: true, isAuthenticated: false };
});

// vitest.config.ts は globals: true を使わないので自動 cleanup が登録されない。
// 手動で外さないと DOM が積み上がり、後続のテストが前のツリーを拾う。
afterEach(cleanup);

describe('AuthCallbackPage', () => {
  it('セッション復元中は何もしない', () => {
    render(<AuthCallbackPage />);

    expect(toastCalls).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  // 実際に観測された不具合。App Router は StrictMode が既定で有効なので、
  // dev では mount effect が setup→cleanup→setup で 2 回走る。
  it('StrictMode で effect が二重に走っても歓迎トーストは 1 回だけ出す', () => {
    authState = {
      isLoading: false,
      isAuthenticated: true,
      user: { id: 1, name: '裕貴 杉田', email: 'me@example.com' },
    };

    render(
      <StrictMode>
        <AuthCallbackPage />
      </StrictMode>,
    );

    expect(toastCalls).toEqual(['success:ようこそ、裕貴 杉田さん！']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('未認証なら StrictMode でもエラートーストは 1 回だけ出してホームへ戻す', () => {
    authState = { isLoading: false, isAuthenticated: false };

    render(
      <StrictMode>
        <AuthCallbackPage />
      </StrictMode>,
    );

    expect(toastCalls).toEqual(['error:認証に失敗しました']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  // /auth/me が 5xx のときは isAuthenticated だけ立って user は入らない。
  // 着地後に名前が届いても、着地をやり直さない(= トーストを積み増さない)。
  it('着地後に user が届いても着地は 1 回で確定する', () => {
    authState = { isLoading: false, isAuthenticated: true };
    const { rerender } = render(<AuthCallbackPage />);

    authState = {
      isLoading: false,
      isAuthenticated: true,
      user: { id: 1, name: '裕貴 杉田', email: 'me@example.com' },
    };
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['success:ログインしました']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });
});
