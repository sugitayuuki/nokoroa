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

/**
 * バックエンドがトークンと同時に発行する「ログイン中かどうか」のヒント。
 * httpOnly ではないのでここから読める（値は `1` 固定で秘密は入っていない）。
 */
const SESSION_HINT_COOKIE_NAME = 'nokoroa_session';

/**
 * ログイン中らしいかを**同期で**判定する。
 *
 * JWT は httpOnly クッキーなので、本来ログイン状態は `/auth/me` を 1 往復しないと
 * 分からない。それを全訪問者に待たせると（認証確定まで画面を出さないため）
 * 未ログインの初回表示が丸ごと 1 RTT 遅くなる。
 * ヒントがあるときだけサーバーに確認し、無ければ即「未ログイン」と判断する。
 *
 * **これは認可の判断には使えない**。JS から書き換えられるため、保護リソースを
 * 守るのはあくまでサーバー側の JWT 検証。ここでの用途は初期表示の分岐だけで、
 * ヒントが嘘だった場合も `/auth/me` の結果で必ず上書きされる。
 */
export const hasSessionHint = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.cookie
    .split(';')
    .some((entry) => entry.trim().startsWith(`${SESSION_HINT_COOKIE_NAME}=`));
};
