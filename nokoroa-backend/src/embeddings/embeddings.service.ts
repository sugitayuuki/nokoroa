import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SimilarPostHit {
  postId: number;
  distance: number;
}

export const EMBEDDING_DIM = 768;
const EMBED_TIMEOUT_MS = 10_000;
const MAX_TEXT_LEN = 8000;

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly aiServiceUrl: string;
  private readonly internalToken: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8000';
    this.internalToken =
      this.configService.get<string>('INTERNAL_AI_TOKEN') || '';
  }

  async generateForPost(
    postId: number,
    title: string,
    content: string,
  ): Promise<void> {
    const fullText = `${title}\n\n${content}`.trim();
    if (!fullText) return;
    const text = fullText.slice(0, MAX_TEXT_LEN);

    let vector: number[];
    try {
      vector = await this.embed(text, 'RETRIEVAL_DOCUMENT');
    } catch (err) {
      this.logger.warn(
        `Failed to embed post ${postId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return;
    }

    const literal = this.vectorLiteral(vector);
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO post_embedding ("postId", "contentText", embedding, "createdAt", "updatedAt")
         VALUES ($1, $2, $3::vector, NOW(), NOW())
         ON CONFLICT ("postId") DO UPDATE SET
           "contentText" = EXCLUDED."contentText",
           embedding = EXCLUDED.embedding,
           "updatedAt" = NOW()`,
        postId,
        text,
        literal,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to upsert embedding for post ${postId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  async searchSimilar(query: string, limit = 5): Promise<SimilarPostHit[]> {
    const trimmed = query?.trim() ?? '';
    if (!trimmed) return [];
    const text = trimmed.slice(0, MAX_TEXT_LEN);

    let vector: number[];
    try {
      vector = await this.embed(text, 'RETRIEVAL_QUERY');
    } catch (err) {
      this.logger.warn(
        `Failed to embed query: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return [];
    }

    const literal = this.vectorLiteral(vector);

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { postId: number; distance: number }[]
      >(
        `SELECT pe."postId", (pe.embedding <=> $1::vector)::float8 AS distance
         FROM post_embedding pe
         JOIN post p ON p.id = pe."postId"
         WHERE p."isPublic" = true
         ORDER BY pe.embedding <=> $1::vector
         LIMIT $2`,
        literal,
        limit,
      );
      return rows.map((r) => ({
        postId: Number(r.postId),
        distance: Number(r.distance),
      }));
    } catch (err) {
      this.logger.warn(
        `Vector search failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return [];
    }
  }

  private async embed(text: string, taskType: string): Promise<number[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.internalToken) {
      headers['X-Internal-Token'] = this.internalToken;
    }

    const res = await fetch(`${this.aiServiceUrl}/api/embeddings/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, task_type: taskType }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`embedding service responded ${res.status}`);
    }
    const data = (await res.json()) as { embedding?: unknown };
    if (
      !Array.isArray(data.embedding) ||
      data.embedding.length !== EMBEDDING_DIM ||
      !data.embedding.every((v) => typeof v === 'number' && Number.isFinite(v))
    ) {
      throw new Error('invalid embedding response');
    }
    return data.embedding as number[];
  }

  private vectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
