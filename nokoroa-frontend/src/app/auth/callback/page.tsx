'use client';

import { CircularProgress, Container, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { toast } from 'react-hot-toast';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const userString = searchParams.get('user');

      if (token && userString) {
        try {
          // トークンをlocalStorageに保存
          localStorage.setItem('jwt', token);

          // ユーザー情報をパース
          const user = JSON.parse(decodeURIComponent(userString));

          // 成功メッセージ
          toast.success(`ようこそ、${user.name}さん！`);

          // ホームページにリダイレクト
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } catch {
          // ユーザーデータの解析でエラーが発生した場合の処理
          toast.error('認証エラーが発生しました');
          router.push('/');
        }
      } else {
        toast.error('認証に失敗しました');
        router.push('/');
      }
    };

    handleCallback();
  }, [searchParams, router]);

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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
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
          <CircularProgress size={60} />
        </Container>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
