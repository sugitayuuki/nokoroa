/** HS256の鍵長。これ未満だとオフライン総当たりで鍵を割られる。 */
const MIN_SECRET_LENGTH = 32;

/**
 * JWT署名鍵を環境変数から取得する。
 *
 * 既定値へのフォールバックは行わない。未設定のまま起動すると、公開されている
 * 固定鍵でトークンを偽造できてしまうため、起動時に失敗させる。
 * 空文字・空白のみ・短すぎる鍵も同様に拒否する。
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Set it before starting the application.',
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return secret;
}
