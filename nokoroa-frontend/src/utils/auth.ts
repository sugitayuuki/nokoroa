// JWT の保存先に関する唯一の情報源。
// バックエンドが httpOnly クッキーを発行していないため localStorage に保持する。
// トークンの読み書きは必ずこのモジュール経由で行い、保存先を差し替えたくなったときに
// 変更箇所が 1 つで済む状態を保つ。
const TOKEN_STORAGE_KEY = 'jwt';

const isBrowser = (): boolean => typeof window !== 'undefined';

/**
 * exp 判定の猶予。トークン寿命(1d)ぶん取ることで、端末時計が最大 2 日
 * 進んでいても発行直後のトークンを「失効」と誤爆しない(誤爆すると
 * ログイン直後に自前削除してしまい、無警告でログイン不能の詰みになる)。
 * ここでの掃除は「明らかに古いトークン」だけが対象で、真の失効判定は
 * 常にサーバ側の 401 が正。
 */
const EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * JWT の exp(秒)を読み、猶予込みで失効していれば true。
 * パースできないトークンは「有効扱い」で返す(判定はサーバ側の 401 に委ねる)。
 * 旧 secureAuth の定期タイマー方式はリスナー不在で一度も動いていなかったため、
 * 読み出し時に失効チェックする方式に置き換えた。
 */
const isExpired = (token: string): boolean => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return false;
    }
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (typeof decoded.exp !== 'number') {
      return false;
    }
    return decoded.exp * 1000 + EXPIRY_GRACE_MS <= Date.now();
  } catch {
    return false;
  }
};

export const getToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && isExpired(token)) {
    // 失効トークンを送り続けても全 API が 401 になるだけなので、ここで掃除する
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
  return token;
};

export const setToken = (token: string): void => {
  if (!isBrowser()) {
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const removeToken = (): void => {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};
