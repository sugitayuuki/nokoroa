/**
 * JWT署名鍵を環境変数から取得する。
 * 既定値へのフォールバックは行わない。未設定のまま起動すると、公開されている
 * 固定鍵でトークンを偽造できてしまうため、起動時に失敗させる。
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Set it before starting the application.',
    );
  }
  return secret;
}
