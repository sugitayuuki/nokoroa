'use client';

import { CircularProgress, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import { useAuth } from '@/providers/AuthProvider';

/**
 * Google 認証後の着地ページ。
 *
 * トークンは URL ではなく httpOnly クッキーで渡ってくるため、ここでは
 * クエリを一切読まない。
 *
 * ログイン状態の確認もこのページでは行わない: このページは OAuth の
 * リダイレクトによる**新規ドキュメント**として読み込まれるので、
 * AuthProvider のマウント時のセッション復元が（クッキー付きで）既に走っている。
 * ここで `/auth/me` を呼ぶと同じ問い合わせが二重になる。
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  /**
   * 着地処理(トースト + 遷移)を済ませたか。
   *
   * このページは router.replace('/') の SPA 遷移が完了するまでマウントされたまま
   * なので、その間に依存が変わると effect が再実行される。実際 user は
   * AuthProvider がセッションを引き直すたびに新しいオブジェクトになるため、
   * 中身が同じでも参照が変わって同じトーストが 2 個出る。
   * 着地は 1 回きりの副作用なので、ref で明示的に一度だけに縛る。
   */
  const hasLandedRef = useRef(false);

  useEffect(() => {
    if (isLoading || hasLandedRef.current) {
      return;
    }
    hasLandedRef.current = true;

    if (!isAuthenticated) {
      toast.error('認証に失敗しました');
    } else {
      toast.success(
        user?.name ? `ようこそ、${user.name}さん！` : 'ログインしました',
      );
    }

    // SPA 遷移にする。フルリロードにすると react-toastify のキューごと
    // 破棄され、上のトーストが一瞬も表示されない。
    // replace にして、戻るボタンでこのページへ帰ってこないようにする。
    router.replace('/');
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={60} sx={{ mb: 3 }} />
      <Typography variant="h6">認証処理中...</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        まもなくリダイレクトされます
      </Typography>
    </Container>
  );
}
