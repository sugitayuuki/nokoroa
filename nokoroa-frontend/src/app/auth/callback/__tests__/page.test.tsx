// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthCallbackPage from '@/app/auth/callback/page';

// next/navigation / react-toastify / AuthProvider は着地ページの外側の関心なので
// 最小のスタブに差し替え、「着地処理が何回走るか」だけを見る。
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

const toastCalls: string[] = [];
vi.mock('react-toastify', () => ({
  toast: {
    success: (m: string) => toastCalls.push(`success:${m}`),
    error: (m: string) => toastCalls.push(`error:${m}`),
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

afterEach(cleanup);

describe('AuthCallbackPage', () => {
  it('セッション復元中は何もしない', () => {
    render(<AuthCallbackPage />);

    expect(toastCalls).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('user の参照が差し替わっても歓迎トーストは 1 回だけ出す', () => {
    const { rerender } = render(<AuthCallbackPage />);

    const profile = { id: 1, name: '裕貴 杉田', email: 'me@example.com' };
    authState = { isLoading: false, isAuthenticated: true, user: profile };
    rerender(<AuthCallbackPage />);

    // AuthProvider がセッションを引き直すと、中身が同じでも user は
    // 新しいオブジェクトになる。これで effect が再発火していた
    authState = {
      isLoading: false,
      isAuthenticated: true,
      user: { ...profile },
    };
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['success:ようこそ、裕貴 杉田さん！']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('名前が取れないときは汎用の文言にする', () => {
    const { rerender } = render(<AuthCallbackPage />);

    authState = { isLoading: false, isAuthenticated: true };
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['success:ログインしました']);
  });

  it('未認証ならエラートーストを 1 回だけ出してホームへ戻す', () => {
    const { rerender } = render(<AuthCallbackPage />);

    authState = { isLoading: false, isAuthenticated: false };
    rerender(<AuthCallbackPage />);
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['error:認証に失敗しました']);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
