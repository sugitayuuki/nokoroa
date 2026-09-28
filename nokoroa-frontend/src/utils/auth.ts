// JWT の保存先に関する唯一の情報源。
// バックエンドが httpOnly クッキーを発行していないため localStorage に保持する。
// トークンの読み書きは必ずこのモジュール経由で行い、保存先を差し替えたくなったときに
// 変更箇所が 1 つで済む状態を保つ。
const TOKEN_STORAGE_KEY = 'jwt';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const getToken = (): string | null => {
  if (!isBrowser()) {
    return null;
  }
  return localStorage.getItem(TOKEN_STORAGE_KEY);
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
