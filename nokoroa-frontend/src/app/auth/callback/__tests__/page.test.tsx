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
// 検証しているつもりで、ただの参照不安定を測ることになる。
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
  // Layout が isLoading 中は children を描画しないため実経路では到達しない。
  // ページ自身の契約として固定し、ゲートの有無に依存させない。
  it('セッション復元中は何もしない(防御的・実経路では到達しない)', () => {
    render(<AuthCallbackPage />);

    expect(toastCalls).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  // 上のケースは「ロード中は着地しない」という上限しか固定しない。
  // 「ロードが解けたら必ず 1 回着地する」という下限も固定しないと、
  // 依存から isLoading が落ちる等で着地が一生起きなくなる退行
  // (= トーストも遷移も出ずスピナーのまま)を見逃す。
  it('ロードが解けたら着地する', () => {
    const { rerender } = render(<AuthCallbackPage />);
    expect(toastCalls).toEqual([]);

    authState = {
      isLoading: false,
      isAuthenticated: true,
      user: { id: 1, name: '裕貴 杉田', email: 'me@example.com' },
    };
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['success:ようこそ、裕貴 杉田さん！']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  // 実際に観測された不具合。
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

  // ここは isLoading **だけ**が変わる遷移。上の「ロードが解けたら着地する」は
  // 同時に isAuthenticated と user も変わるので、依存配列から isLoading が
  // 落ちても別の依存で着地してしまい、その退行を見逃す。
  // (StrictMode の二重実行はマウント時のみで更新時には起きないため、
  //  このケースで効いているのは StrictMode ではなく依存の方。)
  it('isLoading だけが変わる遷移でも 1 回だけ着地する', () => {
    const { rerender } = render(
      <StrictMode>
        <AuthCallbackPage />
      </StrictMode>,
    );
    expect(toastCalls).toEqual([]);

    authState = { isLoading: false, isAuthenticated: false };
    rerender(
      <StrictMode>
        <AuthCallbackPage />
      </StrictMode>,
    );

    expect(toastCalls).toEqual(['error:認証に失敗しました']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  // もう一つの発生源。StrictMode は AuthProvider の復元 effect も二重に
  // 走らせるので /auth/me が 2 本飛び、後から解決した方が 200 を返すと
  // setUser に別のオブジェクトが渡る。着地後に user が変わっても
  // 着地はやり直さない。
  it('着地後に user が差し替わっても着地は 1 回で確定する', () => {
    authState = { isLoading: false, isAuthenticated: true };
    const { rerender } = render(<AuthCallbackPage />);

    // undefined → 名前付き
    const profile = { id: 1, name: '裕貴 杉田', email: 'me@example.com' };
    authState = { isLoading: false, isAuthenticated: true, user: profile };
    rerender(<AuthCallbackPage />);

    // 中身は同じで参照だけ新しい(2 本目の /auth/me が返した別オブジェクト)
    authState = {
      isLoading: false,
      isAuthenticated: true,
      user: { ...profile },
    };
    rerender(<AuthCallbackPage />);

    expect(toastCalls).toEqual(['success:ログインしました']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });
});
