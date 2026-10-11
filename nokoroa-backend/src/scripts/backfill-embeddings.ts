import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

export interface BackfillTally {
  success: number;
  skipped: number;
  failed: number;
}

type BackfillPost = { id: number; title: string; content: string };

/**
 * 投稿を 1 件ずつ埋め込み、成否を数える。
 * スクリプト本体から切り出してあるのは、終了コードの根拠になる
 * 「失敗を success に数えない」という不変条件をテストで固定するため。
 */
export async function tallyBackfill(
  posts: BackfillPost[],
  embeddings: Pick<EmbeddingsService, 'generateForPostStrict'>,
  logger: Pick<Logger, 'warn'>,
): Promise<BackfillTally> {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const post of posts) {
    try {
      // 飲み込む側ではなく Strict を使う。このスクリプトはプロバイダ切替時の
      // 唯一の復旧手段(README 参照)で、成否を取り違えると
      // 「直したつもり」で壊れたまま運用が続く。
      const embedded = await embeddings.generateForPostStrict(
        post.id,
        post.title,
        post.content,
      );
      if (embedded) {
        success += 1;
      } else {
        skipped += 1;
        logger.warn(`post ${post.id}: skipped (title と content が空)`);
      }
    } catch (err) {
      failed += 1;
      logger.warn(
        `post ${post.id}: failed (${err instanceof Error ? err.message : 'unknown'})`,
      );
    }
  }

  return { success, skipped, failed };
}

/**
 * 1 件でも落ちたら埋め込みは歯抜けのままなので、終了コードで分かるようにする。
 * CI やデプロイ手順から呼ばれたとき、無言で次の手順へ進ませない。
 * skipped は「失敗」ではなく「対象外」なので非ゼロにはしない(README 参照)。
 */
export function exitCodeFor(tally: BackfillTally): number {
  return tally.failed > 0 ? 1 : 0;
}

async function main() {
  const logger = new Logger('backfill');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const config = app.get(ConfigService);
    if (!config.get<string>('AI_SERVICE_URL')) {
      logger.error('AI_SERVICE_URL is not set. Aborting to avoid leakage.');
      process.exitCode = 1;
      return;
    }

    const prisma = app.get(PrismaService);
    const embeddings = app.get(EmbeddingsService);
    const onlyMissing = process.argv.includes('--all') ? false : true;

    const where = onlyMissing
      ? { embedding: { is: null }, isPublic: true }
      : { isPublic: true };

    const posts = await prisma.post.findMany({
      where,
      select: { id: true, title: true, content: true },
      orderBy: { id: 'asc' },
    });

    logger.log(`${posts.length} posts to embed (onlyMissing=${onlyMissing})`);

    const { success, skipped, failed } = await tallyBackfill(
      posts,
      embeddings,
      logger,
    );

    logger.log(
      `done — success=${success}, skipped=${skipped}, failed=${failed}`,
    );
    process.exitCode = exitCodeFor({ success, skipped, failed });
  } finally {
    await app.close();
  }
}

// 直接実行されたときだけ走らせる。これが無いと、集計と終了コードを
// テストから import しただけで Nest のアプリ全体が起動してしまう。
if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
}
