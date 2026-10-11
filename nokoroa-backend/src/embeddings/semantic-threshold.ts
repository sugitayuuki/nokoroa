import { Logger } from '@nestjs/common';

// ベクトル検索で「関連あり」とみなすコサイン類似度の下限。
// text-embedding-3-small の日本語では、無関係な文どうしでも 0.3 台が普通に出る。
// 本番データでの実測は 完全一致クエリ=0.73 / 同じ公園という関連=0.44 /
// 無関係=0.33〜0.36 で、0.40 が「関連あり」と「地の雑音」の境目にあたる。
// この値は埋め込みプロバイダに紐付く。変更・切替の手順と本番での反映方法は
// terraform/envs/prod/terraform.tfvars.example の semantic_min_similarity を参照
// (apply だけでは稼働中のタスクに反映されない)。
export const DEFAULT_SEMANTIC_MIN_SIMILARITY = 0.4;

/**
 * 不正な設定値をログに出すための表現を作る。
 * 数値はそのまま出す(秘密値が数値で紛れ込む余地は無く、どの値が弾かれたかが要る)。
 * 文字列は型と長さだけ。誤設定の切り分けにはこれで足り、別の秘密値を
 * 貼り間違えたときに中身がログへ残るのを避けられる。
 */
function describeBadConfigValue(raw: unknown): string {
  if (typeof raw === 'number') return String(raw);
  if (typeof raw !== 'string') return typeof raw;
  return `string(len=${raw.length})`;
}

/**
 * SEMANTIC_MIN_SIMILARITY を解決する。
 * 不正値で 0 に落とすと足切りが無言で無効化されるため、既定値へ戻して警告する。
 *
 * 意味検索とチャットの RAG が同じ値を使う。片方だけ別の値にすると、
 * 同じ埋め込みに対して「関連あり」の基準が 2 つ存在することになる。
 */
export function resolveSemanticMinSimilarity(
  raw: unknown,
  logger: Pick<Logger, 'warn'>,
): number {
  // get<string>() は型アサーションでしかないので、文字列と決めつけない。
  if (raw === undefined || raw === null) {
    return DEFAULT_SEMANTIC_MIN_SIMILARITY;
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    // 空白だけの値は「未設定」と同じ扱いにする。Number('  ') は 0 になるため、
    // ここで弾かないと足切りが無効化された状態で起動してしまう。
    return DEFAULT_SEMANTIC_MIN_SIMILARITY;
  }
  const parsed =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    logger.warn(
      `SEMANTIC_MIN_SIMILARITY is not a number in [0,1] (got ${describeBadConfigValue(raw)}); falling back to ${DEFAULT_SEMANTIC_MIN_SIMILARITY}`,
    );
    return DEFAULT_SEMANTIC_MIN_SIMILARITY;
  }
  if (parsed === 0) {
    // 0 は「足切りを全部外す」逃げ道として有効値のまま残すが、
    // 事故で 0 が入ると元の不具合(無関係な投稿が並ぶ)に静かに戻るため、
    // 無効値と違って正常系でも必ず痕跡を残す。
    logger.warn(
      'SEMANTIC_MIN_SIMILARITY=0: 意味検索とチャットの足切りは無効です（関連の薄い投稿も返します）',
    );
  }
  return parsed;
}
