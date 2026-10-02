'use client';

import { CircularProgress, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { API_CONFIG, createApiRequest } from '@/lib/apiConfig';

/**
 * Google 認証後の着地ページ。
 *
 * トークンは URL ではなく httpOnly クッキーで渡ってくるため、ここでは
 * クエリを一切読まない。クッキーが効いているかはフロントから確認できないので、
 * /auth/me を 1 回呼んでログインできたかを判定する。
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        const response = await createApiRequest(API_CONFIG.endpoints.me);
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          toast.error('認証に失敗しました');
          router.push('/');
          return;
        }

        const user = await response.json();
        if (cancelled) {
          return;
        }

        toast.success(
          user?.name ? `ようこそ、${user.name}さん！` : 'ログインしました',
        );
      } catch {
        if (cancelled) {
          return;
        }
        toast.error('認証に失敗しました');
        router.push('/');
        return;
      }

      // AuthProvider はマウント時に 1 回だけセッションを引くため、SPA 遷移では
      // ログイン状態が反映されない。トップへはフルリロードで移動する。
      // replace にして、戻るボタンでこのページへ帰ってこないようにする。
      window.location.replace('/');
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
