/**
 * 実行環境の判定を1箇所に集約する。
 *
 * 判定が箇所ごとに違うと、staging のような中間環境で
 * 「Swagger は隠れるのに S3 は使われない」といった食い違いが起きる。
 * NODE_ENV 未設定は開発環境とみなさない（安全側に倒す）。
 */
export function isDevelopmentEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === 'development';
}

/** 本番とみなすか。開発・テスト以外はすべて本番相当として扱う。 */
export function isProductionLikeEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !isDevelopmentEnv(nodeEnv) && nodeEnv !== 'test';
}
