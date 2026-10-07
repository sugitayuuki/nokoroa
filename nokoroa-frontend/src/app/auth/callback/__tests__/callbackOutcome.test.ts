import { describe, expect, it } from 'vitest';

import { decideCallbackOutcome } from '../callbackOutcome';

const user = { id: 2, name: '裕貴 杉田', email: 'user@example.com' };

describe('decideCallbackOutcome', () => {
  // 本件の回帰テスト。検証が通っていないのに成功を名乗ると、
  // 成功トーストが出た直後に未ログインのトップへ落ちる
  it.each([
    ['unauthenticated', { status: 'unauthenticated' } as const],
    ['unavailable', { status: 'unavailable', statusCode: 500 } as const],
  ])('セッション検証が %s なら成功を名乗らない', (_label, session) => {
    expect(decideCallbackOutcome({ token: 'jwt', session }).kind).toBe(
      'failure',
    );
  });

  it('検証が通ればユーザー名で成功を伝え、トークンは残す', () => {
    expect(
      decideCallbackOutcome({ token: 'jwt', session: { status: 'ok', user } }),
    ).toEqual({
      kind: 'success',
      toast: 'ようこそ、裕貴 杉田さん！',
      discardToken: false,
    });
  });

  it('検証は通ったが user が取れなければ名前なしで成功を伝える', () => {
    const outcome = decideCallbackOutcome({
      token: 'jwt',
      session: { status: 'ok', user: undefined },
    });

    expect(outcome).toEqual({
      kind: 'success',
      toast: 'ログインしました',
      discardToken: false,
    });
  });

  it('URL にトークンが無ければ失敗', () => {
    const outcome = decideCallbackOutcome({ token: null });

    expect(outcome.kind).toBe('failure');
    expect(outcome.kind === 'failure' && outcome.discardToken).toBe(false);
  });

  it('トークンが無効なら破棄する', () => {
    const outcome = decideCallbackOutcome({
      token: 'jwt',
      session: { status: 'unauthenticated' },
    });

    expect(outcome.kind === 'failure' && outcome.discardToken).toBe(true);
  });

  // 発行されたばかりの有効なトークンを一時障害で捨てると、
  // 再読み込みでは復帰できず OAuth 往復をやり直すことになる
  it.each([
    [
      'サーバエラー',
      500,
      'サーバーが一時的にエラーを返しました。時間をおいてもう一度お試しください。',
    ],
    [
      '通信失敗',
      undefined,
      'サーバーに接続できませんでした。通信環境を確認してもう一度お試しください。',
    ],
  ])(
    '検証不能(%s)ではトークンを残し、原因に沿った説明を出す',
    (_label, statusCode, detail) => {
      const outcome = decideCallbackOutcome({
        token: 'jwt',
        session: { status: 'unavailable', statusCode },
      });

      expect(outcome).toEqual({
        kind: 'failure',
        message: 'ログインを完了できませんでした',
        detail,
        discardToken: false,
      });
    },
  );
});
