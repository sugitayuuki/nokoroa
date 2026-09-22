import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 非公開投稿の埋め込み行を削除する一回限りのメンテナンススクリプト。
 *
 * 以前の実装は isPublic を見ずに埋め込みを生成していたため、非公開投稿の本文が
 * post_embedding.contentText に平文で残っている。現在は検索側の二重フィルタで
 * 外部には出ないが、可視性カラムを持たないテーブルに残す理由が無いので消す。
 *
 * 実行: npm run purge:private-embeddings
 * 確認のみ: npm run purge:private-embeddings -- --dry-run
 */
async function main() {
  const logger = new Logger('purge-private-embeddings');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const dryRun = process.argv.includes('--dry-run');

    const targets = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM post_embedding pe
      JOIN post p ON p.id = pe."postId"
      WHERE p."isPublic" = false
    `;
    const count = Number(targets[0]?.count ?? 0);

    if (dryRun) {
      logger.log(`dry-run: ${count} row(s) would be deleted`);
      return;
    }

    const deleted = await prisma.$executeRaw`
      DELETE FROM post_embedding pe
      USING post p
      WHERE p.id = pe."postId" AND p."isPublic" = false
    `;
    logger.log(`deleted ${deleted} row(s) (matched ${count})`);
  } finally {
    await app.close();
  }
}

void main();
