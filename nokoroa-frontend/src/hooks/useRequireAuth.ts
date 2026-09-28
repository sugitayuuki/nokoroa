'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/providers/AuthProvider';

export interface UseRequireAuthResult {
  /**
   * 認証状態の判定中かどうか。
   * true の間は「未認証」と確定していないため、リダイレクトしてはいけない。
   */
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /**
   * 認証判定が完了し、かつ認証済み。
   * ページ本体を描画してよいかどうかの単一の判断材料。
   */
  isReady: boolean;
}

/**
 * 認証が必須のページ用ガード。
 * 認証判定の完了を待ってから未認証ならリダイレクトする。
 *
 * 使い方(基本形):
 *   const { isAuthLoading, isReady } = useRequireAuth();
 *   if (!isReady) {
 *     return isAuthLoading ? <CircularProgress /> : null;
 *   }
 * ページ独自のローディング(useUser 等)と合成する場合は、
 * `if (!isReady && !isAuthLoading) return null;` で未認証だけ先に落とし、
 * スピナー表示は既存のローディング分岐へ相乗りさせてよい。
 */
export function useRequireAuth(redirectTo = '/login'): UseRequireAuthResult {
  const router = useRouter();
  const { isAuthenticated, isLoading, isLoggingOut } = useAuth();
  // リダイレクト実行後の再レンダリングで二重に遷移を発行しないようにする
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || hasRedirected.current) {
      return;
    }
    if (isLoggingOut) {
      // 意図的なログアウト中は logout() の push('/') に行き先を譲る。
      // ここで /login へ replace すると、ログアウトしたのにログイン画面へ
      // 着地してしまう(フラグは AuthProvider がパス変化で戻す)
      return;
    }
    hasRedirected.current = true;
    // ガードによる離脱は履歴に残さない(戻るボタンで保護ページに戻ると再度弾かれるため)
    router.replace(redirectTo);
  }, [isAuthenticated, isLoading, isLoggingOut, redirectTo, router]);

  return {
    isAuthLoading: isLoading,
    isAuthenticated,
    isReady: !isLoading && isAuthenticated,
  };
}
