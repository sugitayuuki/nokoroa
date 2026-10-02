import { CookieOptions, Response } from 'express';

import { isDevelopmentEnv } from '../common/environment';

/**
 * JWT を載せる Cookie 名。httpOnly なのでフロントの JS からは読めない。
 * 名前を知る必要があるのはこのモジュールと JwtStrategy の取り出し処理だけ。
 */
export const AUTH_COOKIE_NAME = 'nokoroa_token';

/**
 * Cookie の寿命。JwtModule の signOptions.expiresIn('1d') と必ず揃える。
 * ずれると「Cookie は残っているが JWT は失効済み」という状態が生まれ、
 * ログイン済みに見えて全 API が 401 を返す無言の詰みになる。
 */
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 認証 Cookie の属性。発行と削除で必ず同じ値を使う。
 *
 * - httpOnly: JS から読めなくし、XSS 1 つでトークンを持ち出せる状態をなくす
 * - sameSite=Lax: フロントと API は同一サイト（本番は同一オリジン、開発は
 *   localhost のポート違い = 同一サイト）なので Lax で届く。かつ Lax は
 *   クロスサイトからの POST/PUT/DELETE に Cookie を乗せないため、
 *   Cookie 認証に移したことで開いた CSRF 面をこれで閉じている。
 *   Google からのコールバック着地はトップレベル GET 遷移なので Lax でも送られる。
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

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

/**
 * 認証 Cookie を消す。
 *
 * ブラウザは「名前 + Path + Domain」が一致する Cookie しか上書きしないため、
 * 発行時と同じ属性で消す必要がある。maxAge だけは外す
 * （clearCookie は失効済みの expires を入れるので、maxAge が残っていると
 * そちらが優先されて削除にならない）。
 */
export function clearAuthCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, options);
}
