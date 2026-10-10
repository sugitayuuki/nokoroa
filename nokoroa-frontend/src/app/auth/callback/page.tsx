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
   * 観測された不具合: `next dev` で着地すると歓迎トーストが 2 個出る。
   * dev は StrictMode が既定で有効(App Router)なので mount effect が
   * setup→cleanup→setup で 2 回走る。Layout は isLoading の間 children を
   * 描画せず、このページは認証確定後にマウントされるため、その 2 回が
   * そのまま 2 回の着地になる。
   *
   * 発生源はもう一つある。StrictMode は AuthProvider の復元 effect も
   * 二重に走らせるので `/auth/me` が 2 本飛ぶ。後から解決した方が 200 と
   * 想定どおりの形を返せば setUser に新しいオブジェクトが渡り、下の user
   * 依存が変わって着地がもう一度走る(ガード無しだと実測で計 3 回。5xx 等で
   * user が差し替わらなければ 2 回)。
   *
   * ref は StrictMode の擬似 remount をまたいで保持されるので両方を塞げる。
   * 依存配列は exhaustive-deps を満たすための形で、実行回数はこのフラグが
   * 1 回に固定する。
   *
   * ref はこのインスタンス限りなので、本物の remount(新しいドキュメントでの
   * 再ログイン等)では初期化される。別の着地には別のトーストが要るのでそれでよい。
   */
  const hasLandedRef = useRef(false);

  useEffect(() => {
    // isLoading 判定は現状 Layout のゲートに守られて到達しないが、
    // このページ自身の契約として残す(ゲートの有無に依存させない)。
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
