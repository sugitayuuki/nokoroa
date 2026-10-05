import { CookieOptions, Response } from 'express';

import { isDevelopmentEnv } from '../common/environment';

/**
 * JWT を載せる Cookie 名。httpOnly なのでフロントの JS からは読めない。
 * 名前を知る必要があるのはこのモジュールと JwtStrategy の取り出し処理だけ。
 */
export const AUTH_COOKIE_NAME = 'nokoroa_token';

/**
 * 「ログイン中かどうか」だけを伝える Cookie 名。**httpOnly にしない**。
 *
 * JWT が httpOnly になった結果、フロントは起動時に `/auth/me` を 1 往復するまで
 * ログイン状態を知れなくなった。未ログインの訪問者にもこの待ちが乗ると、
 * 全ページの初回表示が 1 RTT 遅くなる（Layout が認証確定まで描画しないため）。
 *
 * そこでログイン状態の有無だけを JS から読める Cookie に出し、未ログインの訪問者が
 * 同期的に「未ログイン」と判断できるようにする。値に秘密は入れない（`1` 固定）ので、
 * 読めても盗めるものが無い。これが改ざんされても、保護リソースを守るのは
 * あくまで `nokoroa_token` の JWT 検証側であり、こちらは表示のヒントに過ぎない。
 *
 * 必ず AUTH_COOKIE_NAME と同時に発行・削除する（下の set/clear が唯一の経路）。
 * 片方だけ残すと「ログイン中の表示なのに 401」「ログイン済みなのに未ログイン表示」
 * のどちらかになる。
 *
 * ⚠️ この名前はフロントエンドと**別リポジトリ階層にまたがる契約**。
 * `nokoroa-frontend/src/utils/auth.ts` の SESSION_HINT_COOKIE_NAME と同じ値で
 * なければならない。片方だけ変えると、ログイン済みの全ユーザーが未ログイン表示に
 * なるが、両側のテストは緑のまま（型でもテストでも検出できない）。
 */
export const SESSION_HINT_COOKIE_NAME = 'nokoroa_session';

/**
 * Cookie の寿命。JWT の有効期限と必ず揃える。
 * ずれると「Cookie は残っているが JWT は失効済み」という状態が生まれ、
 * ログイン済みに見えて全 API が 401 を返す無言の詰みになる。
 *
 * この定数が**唯一の正**で、JwtModule の signOptions.expiresIn は
 * auth.module.ts がここから導出する（二重管理をやめ、ずれを構造的に防ぐ）。
 */
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** JwtModule の signOptions.expiresIn に渡す秒数。上の寿命から導出する。 */
export const AUTH_TOKEN_EXPIRES_IN_SECONDS = AUTH_COOKIE_MAX_AGE_MS / 1000;

/**
 * 認証 Cookie の属性。発行と削除で必ず同じ値を使う。
 *
 * - httpOnly: JS から読めなくし、XSS 1 つでトークンを持ち出せる状態をなくす
 * - sameSite=Lax: フロントと API は同一サイト（本番は同一オリジン、開発は
 *   localhost のポート違い = 同一サイト）なので Lax で届く。Lax はクロスサイトからの
 *   POST/PUT/DELETE に Cookie を乗せないので CSRF 面を狭めるが、**これだけでは
 *   閉じない**（クロスサイトのトップレベル GET 遷移には Cookie が乗る）。
 *   残りは FetchMetadataMiddleware と OAuth の state で閉じている。
 *   Strict にできないのは、Google のコールバック着地で Cookie が送られなくなり
 *   正規のログインが成立しなくなるため。
 * - secure: 開発環境は http なので外す。それ以外（test / staging / production）は付ける
 * - path=/: API は /api 配下だが、将来 Cookie を読む経路が増えても取りこぼさないようにする
 */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDevelopmentEnv(),
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

/**
 * ログイン状態ヒントの属性。認証 Cookie と同じ寿命・同じ送信条件にし、
 * httpOnly だけ外す（フロントが読めなければ意味が無いため）。
 */
export function sessionHintCookieOptions(): CookieOptions {
  return { ...authCookieOptions(), httpOnly: false };
}

/** JWT とログイン状態ヒントをまとめて発行する。 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.cookie(SESSION_HINT_COOKIE_NAME, '1', sessionHintCookieOptions());
}

/**
 * 認証 Cookie とログイン状態ヒントをまとめて消す。
 *
 * ブラウザは「名前 + Path + Domain」が一致する Cookie しか上書きしないため、
 * 発行時と同じ属性で消す必要がある。maxAge は渡さない
 * （express の clearCookie は失効済みの expires を入れるので不要。
 * express 5 は渡された maxAge を自ら捨てるが、意図を明示するために外しておく）。
 */
export function clearAuthCookie(res: Response): void {
  const { maxAge: _authMaxAge, ...authOptions } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, authOptions);

  const { maxAge: _hintMaxAge, ...hintOptions } = sessionHintCookieOptions();
  res.clearCookie(SESSION_HINT_COOKIE_NAME, hintOptions);
}
