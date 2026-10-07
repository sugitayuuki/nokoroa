import { AuthSessionResult } from '@/lib/authSession';

/**
 * コールバック画面の入力。
 * URL にトークンが無い場合は検証自体が走らないため、session を持たない形にする。
 */
export type CallbackInput =
  | { token: null }
  | { token: string; session: AuthSessionResult };

export type CallbackOutcome =
  | { kind: 'success'; toast: string; discardToken: false }
  | {
      kind: 'failure';
      message: string;
      detail: string;
      /** 恒久的に無効なトークンだけ破棄する。一時障害では残して再読み込みで回復させる */
      discardToken: boolean;
    };

/**
 * 検証結果から画面に出す内容とトークンの扱いを決める。
 *
 * 「保存できたから成功」ではなく「検証が通ったから成功」であることを、
 * React を介さずに検証できるようこの関数へ閉じ込めている。
 */
export const decideCallbackOutcome = (
  input: CallbackInput,
): CallbackOutcome => {
  if (input.token === null) {
    return {
      kind: 'failure',
      message: 'ログインに失敗しました',
      detail: '認証情報が受け取れませんでした。もう一度お試しください。',
      discardToken: false,
    };
  }

  const { session } = input;

  if (session.status === 'ok') {
    return {
      kind: 'success',
      toast: session.user
        ? `ようこそ、${session.user.name}さん！`
        : 'ログインしました',
      discardToken: false,
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

  // statusCode があれば接続は出来ている。「接続できません」と言うと原因をミスリードする
  return {
    kind: 'failure',
    message: 'ログインを完了できませんでした',
    detail: session.statusCode
      ? 'サーバーが一時的にエラーを返しました。時間をおいてもう一度お試しください。'
      : 'サーバーに接続できませんでした。通信環境を確認してもう一度お試しください。',
    discardToken: false,
  };
};
