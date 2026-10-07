import { AuthSessionResult, UnavailableReason } from '@/lib/authSession';

export type CallbackOutcome =
  | { kind: 'success'; toast: string }
  | {
      kind: 'failure';
      message: string;
      detail: string;
      /** 恒久的に無効なトークンだけ破棄する */
      discardToken: boolean;
      /** 保持したトークンで回復しうる場合の再試行先。無ければ再ログインが必要 */
      retryHref?: string;
    };

/** 検証できなかった場合の回復先。AuthProvider が保持したトークンを再検証する */
const RETRY_HREF = '/';

/** 原因を取り違えると対処もミスリードするため、理由ごとに言い分ける */
const UNAVAILABLE_DETAIL: Record<UnavailableReason['reason'], string> = {
  server:
    'サーバーが一時的にエラーを返しました。時間をおいてもう一度お試しください。',
  timeout:
    'サーバーの応答がありませんでした。時間をおいてもう一度お試しください。',
  network:
    'サーバーに接続できませんでした。通信環境を確認してもう一度お試しください。',
  intercepted:
    'ネットワーク側で応答が差し替えられました。接続中のネットワークを確認してください。',
};

/**
 * 検証結果から画面に出す内容とトークンの扱いを決める。
 * session が null は「URL からトークンを受け取れなかった」= 検証に至っていない。
 */
export const decideCallbackOutcome = (
  session: AuthSessionResult | null,
): CallbackOutcome => {
  if (session === null) {
    return {
      kind: 'failure',
      message: 'ログインに失敗しました',
      detail: '認証情報が受け取れませんでした。もう一度お試しください。',
      discardToken: false,
    };
  }

  if (session.status === 'ok') {
    return {
      kind: 'success',
      toast: session.user
        ? `ようこそ、${session.user.name}さん！`
        : 'ログインしました',
    };
  }

  if (session.status === 'unauthenticated') {
    return {
      kind: 'failure',
      message: 'ログインに失敗しました',
      detail:
        '認証情報が受け付けられませんでした。お手数ですがもう一度ログインしてください。',
      discardToken: true,
    };
  }

  return {
    kind: 'failure',
    message: 'ログインを完了できませんでした',
    detail: UNAVAILABLE_DETAIL[session.reason],
    discardToken: false,
    retryHref: RETRY_HREF,
  };
};
