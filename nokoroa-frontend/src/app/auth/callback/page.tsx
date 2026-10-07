'use client';

import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { fetchAuthSession } from '@/lib/authSession';
import { removeToken, setToken } from '@/utils/auth';

type CallbackState =
  | { phase: 'verifying' }
  | { phase: 'failed'; message: string; detail?: string };

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ phase: 'verifying' });
  // StrictMode は effect を 2 回実行する。素通しすると成功トーストが 2 回出て、
  // プロフィール API も二重に叩かれる。
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const completeLogin = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setState({
          phase: 'failed',
          message: 'ログインに失敗しました',
          detail: '認証情報が受け取れませんでした。もう一度お試しください。',
        });
        return;
      }

      setToken(token);

      // トークンを保存しただけでは「ログインできた」とは言えない。
      // 実際にセッションが使えることを確かめてから成功を名乗る。
      // ここを省くと、サーバ側が落ちていても成功トーストが出たうえで
      // 直後に AuthProvider がログアウト扱いにする、という嘘の成功になる。
      const session = await fetchAuthSession();

      if (session.status === 'ok') {
        toast.success(
          session.user
            ? `ようこそ、${session.user.name}さん！`
            : 'ログインしました',
        );
        // 保存したトークンを URL に残したまま履歴へ積まないよう置換で遷移する
        window.location.replace('/');
        return;
      }

      // 失敗したらトークンは残さない。残すと他の画面で中途半端に
      // 「ログイン済みのように見えて全部 401」という状態になる。
      removeToken();

      if (session.status === 'unauthenticated') {
        setState({
          phase: 'failed',
          message: 'ログインに失敗しました',
          detail:
            '認証情報が受け付けられませんでした。お手数ですがもう一度ログインしてください。',
        });
        return;
      }

      setState({
        phase: 'failed',
        message: 'ログインを完了できませんでした',
        detail:
          'サーバーに接続できませんでした。時間をおいてもう一度お試しください。',
      });
    };

    void completeLogin();
  }, [searchParams]);

  if (state.phase === 'failed') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {state.message}
          </Typography>
          {state.detail && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {state.detail}
            </Typography>
          )}
        </Alert>
        <Button variant="contained" href="/login">
          ログイン画面へ
        </Button>
      </Container>
    );
  }

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
