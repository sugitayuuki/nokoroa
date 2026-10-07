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

import { decideCallbackOutcome } from './callbackOutcome';

/** 成功トーストを読める時間だけ見せてから遷移する */
const SUCCESS_TOAST_MS = 1000;

type CallbackState =
  | { phase: 'verifying' }
  | { phase: 'failed'; message: string; detail: string };

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ phase: 'verifying' });
  // StrictMode は effect を 2 回実行する。素通しすると成功トーストが 2 回出て、
  // プロフィール API も二重に叩かれる。
  // 入口は常にフルページ遷移なので、再実行が必要になることはない
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const completeLogin = async () => {
      const token = searchParams.get('token');

      // トークンと(バックエンドが付与する)メールアドレス入り user をアドレスバー・
      // 履歴・Referer に残さない。失敗時はこの画面に留まるため特に必要
      window.history.replaceState({}, '', window.location.pathname);

      if (token) {
        setToken(token);
      }

      // トークンを保存しただけでは「ログインできた」とは言えない。
      // 実際にセッションが使えることを確かめてから成功を名乗る
      const outcome = decideCallbackOutcome(
        token === null
          ? { token: null }
          : { token, session: await fetchAuthSession() },
      );

      if (outcome.kind === 'success') {
        toast.success(outcome.toast);
        // フルロードで遷移する。AuthProvider の検証 effect は deps が空で
        // 再実行されないため、SPA 遷移では認証状態が反映されない
        setTimeout(() => window.location.replace('/'), SUCCESS_TOAST_MS);
        return;
      }

      if (outcome.discardToken) {
        removeToken();
      }
      setState({
        phase: 'failed',
        message: outcome.message,
        detail: outcome.detail,
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
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {state.detail}
          </Typography>
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
