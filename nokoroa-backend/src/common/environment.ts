/**
 * 実行環境の判定を1箇所に集約する。
 *
 * 判定が箇所ごとに違うと、staging のような中間環境で
 * 「Swagger は隠れるのに S3 は使われない」といった食い違いが起きる。
 * NODE_ENV 未設定は開発環境とみなさない（安全側に倒す）。
 */
const KNOWN_ENVS = ['development', 'test', 'staging', 'production', 'prod'];

export function isDevelopmentEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === 'development';
}

/**
 * テスト実行中か。
 * レート制限の無効化など、本番で有効になってはいけない緩和の条件に使う。
 */
export function isTestEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === 'test';
}

/** 本番とみなすか。開発・テスト以外はすべて本番相当として扱う。 */
export function isProductionLikeEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return !isDevelopmentEnv(nodeEnv) && !isTestEnv(nodeEnv);
}

/**
 * NODE_ENV が想定内の値かを起動時に検証する。
 *
 * NODE_ENV=test はレート制限を全て無効化し、S3 も使わなくなる。
 * 他の必須設定は fail-fast するのに NODE_ENV だけ無検証だと、
 * 打ち間違いが「無言で防御が消える」形で本番に載りうるため。
 */
export function assertKnownEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv && !KNOWN_ENVS.includes(nodeEnv)) {
    throw new Error(
      `NODE_ENV="${nodeEnv}" is not recognized. Use one of: ${KNOWN_ENVS.join(', ')}.`,
    );
  }
}
