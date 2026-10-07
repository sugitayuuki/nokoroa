import { describe, expect, it } from 'vitest';

import { decideCallbackOutcome } from '@/lib/callbackOutcome';

const user = { id: 2, name: '裕貴 杉田', email: 'user@example.com' };

describe('decideCallbackOutcome', () => {
  // 検証が通っていないのに成功を名乗ると、成功トーストの直後に
  // 未ログインのトップへ落ちる
  it.each([
    ['トークンを受け取れなかった', null],
    ['トークンが無効', { status: 'unauthenticated' } as const],
    [
      'サーバエラー',
      { status: 'unavailable', reason: 'server', statusCode: 500 } as const,
    ],
    ['応答なし', { status: 'unavailable', reason: 'timeout' } as const],
    ['到達不能', { status: 'unavailable', reason: 'network' } as const],
    [
      '応答が差し替えられた',
      { status: 'unavailable', reason: 'intercepted' } as const,
    ],
  ])('%s なら成功を名乗らない', (_label, session) => {
    expect(decideCallbackOutcome(session).kind).toBe('failure');
  });

  it('検証が通ればユーザー名で成功を伝える', () => {
    expect(decideCallbackOutcome({ status: 'ok', user })).toEqual({
      kind: 'success',
      toast: 'ようこそ、裕貴 杉田さん！',
    });
  });

  it('検証は通ったが user が取れなければ名前なしで成功を伝える', () => {
    expect(decideCallbackOutcome({ status: 'ok', user: undefined })).toEqual({
      kind: 'success',
      toast: 'ログインしました',
    });
  });

  // 恒久的に無効なトークンで再試行させても同じ失敗を繰り返すだけなので、
  // 再ログインへ送る
  it('トークンが無効なら破棄し、再試行先は出さない', () => {
    expect(decideCallbackOutcome({ status: 'unauthenticated' })).toEqual({
      kind: 'failure',
      message: 'ログインに失敗しました',
      detail:
        '認証情報が受け付けられませんでした。お手数ですがもう一度ログインしてください。',
      discardToken: true,
    });
  });

  it('トークンを受け取れていなければ破棄するものも無い', () => {
    expect(decideCallbackOutcome(null)).toEqual({
      kind: 'failure',
      message: 'ログインに失敗しました',
      detail: '認証情報が受け取れませんでした。もう一度お試しください。',
      discardToken: false,
    });
  });

  // 発行されたばかりの有効なトークンを一時障害で捨てると、
  // 再読み込みでは復帰できず OAuth 往復をやり直すことになる
  it.each([
    [
      'server',
      { status: 'unavailable', reason: 'server', statusCode: 500 } as const,
      'サーバーが一時的にエラーを返しました。時間をおいてもう一度お試しください。',
    ],
    [
      'timeout',
      { status: 'unavailable', reason: 'timeout' } as const,
      'サーバーの応答がありませんでした。時間をおいてもう一度お試しください。',
    ],
    [
      'network',
      { status: 'unavailable', reason: 'network' } as const,
      'サーバーに接続できませんでした。通信環境を確認してもう一度お試しください。',
    ],
    [
      'intercepted',
      { status: 'unavailable', reason: 'intercepted' } as const,
      'ネットワーク側で応答が差し替えられました。接続中のネットワークを確認してください。',
    ],
  ])(
    '検証不能(%s)ではトークンを残し、理由に沿った説明と再試行先を出す',
    (_label, session, detail) => {
      expect(decideCallbackOutcome(session)).toEqual({
        kind: 'failure',
        message: 'ログインを完了できませんでした',
        detail,
        discardToken: false,
        retryHref: '/',
      });
    },
  );

  // 接続できているのに「接続できません」と言うと、ユーザーは自分の
  // 通信環境を疑って無駄な対処をする
  it('サーバが応答している理由では通信環境のせいにしない', () => {
    for (const session of [
      { status: 'unavailable', reason: 'server', statusCode: 503 } as const,
      { status: 'unavailable', reason: 'timeout' } as const,
    ]) {
      const outcome = decideCallbackOutcome(session);

      expect(outcome.kind === 'failure' && outcome.detail).not.toContain(
        '接続できませんでした',
      );
    }
  });
});
