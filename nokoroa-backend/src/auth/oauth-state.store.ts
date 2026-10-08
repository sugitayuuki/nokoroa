import { randomBytes, timingSafeEqual } from 'crypto';
import { Logger } from '@nestjs/common';
import { CookieOptions, Request } from 'express';

import { isDevelopmentEnv } from '../common/environment';

/** OAuth の state を預けるクッキー。認証往復の間だけ生きる。 */
export const OAUTH_STATE_COOKIE_NAME = 'nokoroa_oauth_state';

/**
 * state の寿命。
 *
 * 短すぎると「同意画面でアカウントを選び迷っていたら、正規のログインが
 * state 切れで失敗する」ことになる（この失敗は差分前には起きなかった退行）。
 * 長すぎると盗んだ state を使い回せる窓が広がるため、同意画面の操作に
 * 十分な 30 分に取る。
 */
export const OAUTH_STATE_MAX_AGE_MS = 30 * 60 * 1000;

function stateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // コールバックは Google からのクロスサイトのトップレベル GET 遷移で届くため、
    // Lax でなければ state クッキーが送られず、正規のログインが必ず失敗する。
    sameSite: 'lax',
    secure: !isDevelopmentEnv(),
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_MS,
  };
}

function readStateCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[OAUTH_STATE_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** 長さの違いを漏らさずに比較する。長さが違えば即 false。 */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type StoreCallback = (err: Error | null, state?: string) => void;
type VerifyCallback = (
  err: Error | null,
  ok?: boolean,
  info?: { message: string },
) => void;

/**
 * OAuth の state をクッキーに預ける store（passport-oauth2 の `store` オプション用）。
 *
 * これが無いと、コールバックは**検証なしのトップレベル GET で認証クッキーを発行する**
 * エンドポイントになる。攻撃者が自分の Google アカウントで取得した `code` を
 * 被害者にトップレベル遷移させるだけで、被害者のブラウザに攻撃者アカウントの
 * セッションを固定できてしまう（被害者はその後の投稿を攻撃者アカウントに書き込む）。
 * トークンが URL に出ていた以前と違い、Cookie 化で痕跡も残らなくなったため、
 * ここで state を検証する。
 *
 * パスワード認証と違い passport のセッションを使っていないため、state の保管先は
 * 自分で用意する必要がある。サーバー側に状態を持たずに済むクッキーを選んだ。
 *
 * passport-oauth2 は store / verify の**引数の数**で呼び出し方を切り替える
 * (`lib/strategy.js` の arity 判定)。store は 3、verify は 4 を保つこと。
 */
export class OAuthStateCookieStore {
  private readonly logger = new Logger(OAuthStateCookieStore.name);

  store(req: Request, _meta: unknown, callback: StoreCallback): void {
    const res = req.res;
    if (!res) {
      callback(
        new Error('OAuth state を保存できません（response がありません）'),
      );
      return;
    }

    const state = randomBytes(32).toString('base64url');
    res.cookie(OAUTH_STATE_COOKIE_NAME, state, stateCookieOptions());
    callback(null, state);
  }

  verify(
    req: Request,
    providedState: string | undefined,
    _meta: unknown,
    callback: VerifyCallback,
  ): void {
    const expected = readStateCookie(req);

    // 1 度使った state は成否にかかわらず捨てる（再生を防ぐ）。
    // 発行時と同じ属性で消す必要がある。
    const { maxAge: _maxAge, ...clearOptions } = stateCookieOptions();
    req.res?.clearCookie(OAUTH_STATE_COOKIE_NAME, clearOptions);

    if (!expected || !providedState || !equals(expected, providedState)) {
      // 失敗の理由はフロントまで届かない（passport が汎用の 401 に差し替える）。
      // 攻撃だけでなく「同意画面で時間切れ」「複数タブで state が上書きされた」
      // 「?code= 付き URL のリロード」でも起きるため、原因を追えるよう残す。
      this.logger.warn(
        'Rejected Google callback: OAuth state mismatch ' +
          `(hasCookie=${Boolean(expected)} hasQuery=${Boolean(providedState)})`,
      );
      callback(null, false, {
        message:
          'OAuth の state が一致しません。ログインをやり直してください。',
      });
      return;
    }

    callback(null, true);
  }
}
