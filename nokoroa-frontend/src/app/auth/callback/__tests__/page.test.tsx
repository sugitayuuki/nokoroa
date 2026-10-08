// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSessionResult } from '@/lib/authSession';

import AuthCallbackPage from '../page';

const mocks = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  clearSession: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  replaceLocation: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('@/lib/navigate', () => ({
  replaceLocation: (url: string) => mocks.replaceLocation(url),
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
    success: (message: string) => mocks.toastSuccess(message),
    error: (message: string) => mocks.toastError(message),
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
}));

// clearSession だけを使うため、Provider ごと差し替えて
// 認証状態の実装には踏み込まない
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ clearSession: mocks.clearSession }),
}));

const VERIFIED: AuthSessionResult = {
  status: 'ok',
  user: { id: 2, name: '裕貴 杉田', email: 'user@example.com' },
};

/**
 * 検証の解決と、その後に張られるタイマーまで進める。
 * act で包まないと state 更新が描画に反映される前に assert してしまう。
 */
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const m of Object.values(mocks)) {
    if (typeof m === 'function') m.mockReset();
  }
  mocks.searchParams = new URLSearchParams();
  mocks.getToken.mockReturnValue(null);

  window.history.replaceState({}, '', '/auth/callback?token=jwt&user=%7B%7D');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 本番と同じ StrictMode で描画する。effect は setup → cleanup → setup で走る */
const renderCallback = () =>
  render(
    <StrictMode>
      <AuthCallbackPage />
    </StrictMode>,
  );

describe('AuthCallbackPage', () => {
  describe('検証が通ったとき', () => {
    beforeEach(() => {
      mocks.searchParams = new URLSearchParams('token=jwt&user=%7B%7D');
      mocks.fetchAuthSession.mockResolvedValue(VERIFIED);
    });

    it('トークンを保存し、検証後に名前入りで成功を伝えてから遷移する', async () => {
      renderCallback();
      await settle();

      expect(mocks.setToken).toHaveBeenCalledWith('jwt');
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'ようこそ、裕貴 杉田さん！',
      );
      // トーストを読む時間を確保するため、即時には遷移しない
      expect(mocks.replaceLocation).not.toHaveBeenCalled();

      await settle(1500);
      expect(mocks.replaceLocation).toHaveBeenCalledWith('/');
    });

    // 報告された「ようこそ…が 2 回」の回帰テスト。
    // StrictMode は effect を 2 回実行するので、素通しすると 2 回出る
    it('StrictMode でも成功通知と検証は 1 回だけ', async () => {
      renderCallback();
      await settle(1500);

      expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
      expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1);
      expect(mocks.replaceLocation).toHaveBeenCalledTimes(1);
    });

    // StrictMode の追加 cleanup で離脱フラグが立ったまま残ると、
    // 検証結果が捨てられて「認証処理中...」のまま固着する
    it('StrictMode の追加 cleanup で検証結果が捨てられない', async () => {
      renderCallback();
      await settle(1500);

      // 成功時も固着時もスピナーは出たままなので、描画の有無では両者を
      // 区別できない。apply が実際に走ったことを副作用で見る
      expect(mocks.toastSuccess).toHaveBeenCalled();
      expect(mocks.replaceLocation).toHaveBeenCalledWith('/');
    });

    it('トークンとユーザー情報を URL から取り除く', async () => {
      renderCallback();
      await settle();

      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/auth/callback');
    });

    it('成功時は認証状態を落とさない', async () => {
      renderCallback();
      await settle(1500);

      expect(mocks.removeToken).not.toHaveBeenCalled();
      expect(mocks.clearSession).not.toHaveBeenCalled();
    });
  });

  describe('検証が通らなかったとき', () => {
    beforeEach(() => {
      mocks.searchParams = new URLSearchParams('token=jwt');
    });

    it('トークンが無効なら破棄し、成功を名乗らない', async () => {
      mocks.fetchAuthSession.mockResolvedValue({ status: 'unauthenticated' });

      renderCallback();
      await settle();

      expect(mocks.removeToken).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(mocks.replaceLocation).not.toHaveBeenCalled();
      expect(screen.getByText('ログインに失敗しました')).toBeTruthy();
    });

    // 本件の回帰テスト。サーバの一時障害で発行直後の有効なトークンを
    // 捨てると、再読み込みでは復帰できない
    it('サーバ側の障害ではトークンを残し、再試行先を出す', async () => {
      mocks.fetchAuthSession.mockResolvedValue({
        status: 'unavailable',
        reason: 'server',
      });

      renderCallback();
      await settle();

      expect(mocks.removeToken).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(screen.getByText('ログインを完了できませんでした')).toBeTruthy();
      expect(screen.getByRole('link', { name: '再試行' })).toBeTruthy();
    });

    // 検証前にトークンを差し替えているため、認証状態も揃えないと
    // 「前のユーザーの表示のまま別のトークンで API を叩く」状態が残る
    it('失敗時は認証状態を未ログインに揃える', async () => {
      mocks.fetchAuthSession.mockResolvedValue({
        status: 'unavailable',
        reason: 'network',
      });

      renderCallback();
      await settle();

      expect(mocks.clearSession).toHaveBeenCalled();
    });
  });

  describe('URL にトークンが無いとき', () => {
    it('既にセッションがあればトップへ送る(失敗表示はしない)', async () => {
      mocks.getToken.mockReturnValue('existing');

      renderCallback();
      await settle();

      expect(mocks.replaceLocation).toHaveBeenCalledWith('/');
      expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
      expect(screen.queryByText('ログインに失敗しました')).toBeNull();
    });

    it('セッションも無ければ失敗を表示し、検証はしない', async () => {
      renderCallback();
      await settle();

      expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
      expect(mocks.setToken).not.toHaveBeenCalled();
      expect(screen.getByText('ログインに失敗しました')).toBeTruthy();
    });

    // 空文字を「トークンあり」側に落とすと、既存トークンの検証結果で
    // 成否が決まり、受け取っていないのに成功を名乗る
    it('token が空文字でも「受け取れなかった」として扱う', async () => {
      mocks.searchParams = new URLSearchParams('token=');
      mocks.getToken.mockReturnValue('existing');

      renderCallback();
      await settle();

      expect(mocks.setToken).not.toHaveBeenCalled();
      expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
      expect(mocks.replaceLocation).toHaveBeenCalledWith('/');
    });
  });

  describe('保存に失敗する端末', () => {
    // 失敗 UI に到達できないと「認証処理中...」のまま固着する
    it('setToken が throw しても原因を表示する', async () => {
      mocks.searchParams = new URLSearchParams('token=jwt');
      mocks.setToken.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      renderCallback();
      await settle();

      expect(screen.getByText('ログインを完了できませんでした')).toBeTruthy();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });
  });
});
