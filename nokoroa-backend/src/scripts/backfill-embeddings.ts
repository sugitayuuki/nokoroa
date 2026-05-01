import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

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

    let success = 0;
    let failed = 0;

    for (const post of posts) {
      try {
        await embeddings.generateForPost(post.id, post.title, post.content);
        success += 1;
      } catch (err) {
        failed += 1;
        logger.warn(
          `post ${post.id}: failed (${err instanceof Error ? err.message : 'unknown'})`,
        );
      }
    }

    logger.log(`done — success=${success}, failed=${failed}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
