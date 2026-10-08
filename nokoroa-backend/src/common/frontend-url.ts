/**
 * フロントエンドのベース URL。
 *
 * 末尾のスラッシュを落として返す。`FRONTEND_URL=https://nokoroa.com/` のように
 * 設定されていると、リダイレクト先が `https://nokoroa.com//auth/callback` になり
 * Next.js 側のルーティングに当たらない。
 *
 * 未設定時の localhost フォールバックは開発用。開発環境以外は main.ts が
 * 起動時に設定漏れを失敗させる。
 */
export function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}
