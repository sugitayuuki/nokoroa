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

  it('末尾スラッシュの有無では落とさない', () => {
    expect(() =>
      assertGoogleCallbackUrlMatchesRoute(
        `https://nokoroa.com${GOOGLE_CALLBACK_PATH}/`,
      ),
    ).not.toThrow();
  });

  it('グローバルプレフィックスが抜けていたら起動を止める', () => {
    // 実際に起きた形。同意画面までは正常に進むため、止めないと
    // ユーザーがログインに失敗するまで誰も気づけない
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
