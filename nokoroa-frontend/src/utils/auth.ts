// JWT はバックエンドが httpOnly クッキー(nokoroa_token)で発行するため、
// フロントエンドはトークンを一切保持しない。
// 「ログイン中か」は useAuth() の状態、または API の 401 で判断する。
//
// このモジュールに残っているのは、旧実装が localStorage に残したトークンの
// 後片付けだけ。
const LEGACY_TOKEN_STORAGE_KEY = 'jwt';

/**
 * 旧実装が localStorage に保存していた JWT を削除する。
 *
 * 既存ユーザーの端末には localStorage に有効なトークンが残っており、
 * 放置すると XSS で盗める状態が有効期限(1日)のあいだ続く。
 * もう誰も読まない値なので、アプリ起動時に 1 回だけ消す。
 *
 * localStorage が使えない環境(SSR・プライベートモードの一部ブラウザ)でも
 * 起動を止めないよう、失敗は黙って無視する。
 */
export const purgeLegacyStoredToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    // 消せなくても機能は動く(読む側が既に居ない)
  }
};
