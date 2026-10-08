import {
  GOOGLE_CALLBACK_PATH,
  assertGoogleCallbackUrlMatchesRoute,
} from './google-callback-path';

describe('assertGoogleCallbackUrlMatchesRoute', () => {
  it('マウント先と一致していれば通す', () => {
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        `https://nokoroa.com${GOOGLE_CALLBACK_PATH}`,
      ),
    ).not.toThrow();
  });

  it('末尾スラッシュ 1 個は許す(Express が省略を許す範囲)', () => {
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        `https://nokoroa.com${GOOGLE_CALLBACK_PATH}/`,
      ),
    ).not.toThrow();
  });

  it('末尾スラッシュ 2 個は止める(実際に 404 になる形)', () => {
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        `https://nokoroa.com${GOOGLE_CALLBACK_PATH}//`,
      ),
    ).toThrow(/一致しません/);
  });

  it('パスの一部が違えば止める(定数の打ち間違い・階層変更)', () => {
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        'https://nokoroa.com/api/auth/google/callbackk',
      ),
    ).toThrow(/一致しません/);
  });

  it('グローバルプレフィックスが抜けていたら起動を止める', () => {
    // 実際に起きた形。止めないとユーザーのログイン失敗としてしか表面化しない
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        'https://nokoroa.com/auth/google/callback',
      ),
    ).toThrow(/一致しません/);
  });

  it('URL として壊れていたら起動を止める', () => {
    expect(() => assertGoogleCallbackUrlMatchesRoute('not-a-url')).toThrow(
      /解釈できません/,
    );
  });

  it('未設定なら何もしない(必須判定は GoogleStrategy の責務)', () => {
    expect(() => assertGoogleCallbackUrlMatchesRoute(undefined)).not.toThrow();
  });
});
