'use client';

import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { fetchAuthSession } from '@/lib/authSession';
import { CallbackOutcome, decideCallbackOutcome } from '@/lib/callbackOutcome';
import { useAuth } from '@/providers/AuthProvider';
import { getToken, removeToken, setToken } from '@/utils/auth';

/** 成功トーストを読める時間だけ見せてから遷移する */
const REDIRECT_DELAY_MS = 1500;

/** 原因を特定できない失敗。決め打ちで説明するとユーザーを無関係な対処に誘導する */
const FAILED_UNEXPECTEDLY: CallbackOutcome = {
  kind: 'failure',
  message: 'ログインを完了できませんでした',
  detail:
    'ログイン処理中に問題が発生しました。この端末で Cookie やストレージがブロックされていないか確認のうえ、もう一度お試しください。',
  discardToken: false,
};

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<CallbackOutcome>();
  // StrictMode は effect を 2 回実行する。素通しすると成功トーストが 2 回出て、
  // プロフィール API も二重に叩かれる。
  // 入口は常にフルページ遷移なので、再実行が必要になることはない
  const hasRunRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leftRef = useRef(false);
  const { clearSession } = useAuth();

  // 待機中のリダイレクトはアンマウント時だけ取り消す。検証 effect の cleanup に
  // 置くと、下で呼ぶ replaceState が searchParams を差し替えて cleanup を走らせ、
  // 成功後の遷移そのものを消してしまう
  useEffect(() => {
    // StrictMode は setup → cleanup → setup の順に走り ref は保持されるため、
    // setup で戻さないと追加 cleanup で立った離脱フラグが残り、
    // dev では検証結果が常に捨てられて画面が固着する
    leftRef.current = false;

    return () => {
      // 検証は最大 10 秒かかる。その間にユーザーがヘッダー等から離脱したら、
      // 後から解決した検証結果で勝手にトップへ引き戻さない
      leftRef.current = true;
      clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const completeLogin = async () => {
      // 空文字も「受け取れなかった」として扱う。保存と判定で述語が分かれると、
      // URL のトークンではなく既存トークンの検証結果で成否が決まってしまう
      const token = searchParams.get('token') || null;

      // トークンと(バックエンドが付与する)メールアドレス入り user をアドレスバー・
      // 履歴・Referer に残さない。失敗時はこの画面に留まるため特に必要
      window.history.replaceState({}, '', window.location.pathname);

      // 受け取るトークンが無いのに既にセッションがあるなら、この画面に用は無い。
      // 失敗画面を再読み込みした場合やブックマークからの再訪問で、
      // ログイン中のユーザーに「ログインに失敗しました」を見せないようにする
      if (!token) {
        if (getToken()) {
          window.location.replace('/');
          return undefined;
        }
        return decideCallbackOutcome(null);
      }

      setToken(token);

      // トークンを保存しただけでは「ログインできた」とは言えない。
      // 実際にセッションが使えることを確かめてから成功を名乗る
      return decideCallbackOutcome(await fetchAuthSession());
    };

    const apply = (next: CallbackOutcome | undefined) => {
      // undefined は遷移中。離脱後も同様に、この画面では何もしない
      if (!next || leftRef.current) return;

      if (next.kind === 'success') {
        toast.success(next.toast);
        // フルロードで遷移する。AuthProvider の検証 effect は deps が空で
        // 再実行されないため、SPA 遷移では認証状態が反映されない
        redirectTimerRef.current = setTimeout(
          () => window.location.replace('/'),
          REDIRECT_DELAY_MS,
        );
        return;
      }
      if (next.discardToken) {
        removeToken();
      }
      // 検証前にトークンを差し替えているため、認証状態も揃えないと
      // 「前のユーザーの表示のまま別のトークンで API を叩く」状態が残る
      clearSession();
      setOutcome(next);
    };

    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // localStorage が使えない端末では setToken が throw する。投げ捨てると
    // 失敗 UI に到達できず「認証処理中...」のまま固着する。
    // apply 自身の throw も拾えるよう then の第 2 引数ではなく catch を使う
    completeLogin()
      .then(apply)
      .catch(() => apply(FAILED_UNEXPECTEDLY));
  }, [searchParams, clearSession]);

  if (outcome?.kind === 'failure') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {outcome.message}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {outcome.detail}
          </Typography>
        </Alert>
        <Stack direction="row" spacing={2}>
          {outcome.retryHref && (
            <Button variant="contained" href={outcome.retryHref}>
              再試行
            </Button>
          )}
          <Button
            variant={outcome.retryHref ? 'outlined' : 'contained'}
            href="/login"
          >
            ログイン画面へ
          </Button>
        </Stack>
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
