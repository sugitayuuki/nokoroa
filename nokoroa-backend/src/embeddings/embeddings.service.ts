import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SimilarPostHit {
  postId: number;
  distance: number;
}

export const EMBEDDING_DIM = 768;
const EMBED_TIMEOUT_MS = 10_000;
// gemini-embedding-001 の入力上限は 2,048 トークン。日本語はおおよそ
// 1文字1トークン前後なので、文字数で保守的に切る。
// 超過分はモデル側で黙って切り捨てられる（＝後半が検索に効かなくなる）ため、
// アプリ側で上限を管理する。
const MAX_TEXT_LEN = 2000;
// pgvector の HNSW は動的候補リスト(hnsw.ef_search、既定40)を超える行を返せない。
// ここを 40 より大きくすると「上限まで返る」という契約が実装と食い違う。
// 40 を超えたい場合は SET LOCAL hnsw.ef_search をトランザクション内で発行する必要がある。
const MAX_LIMIT = 40;

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
    if (!this.internalToken) {
      this.logger.warn(
        'INTERNAL_AI_TOKEN is not configured; AI service will reject requests',
      );
    }
  }

  /**
   * 埋め込みを生成して保存する。失敗時は例外を投げる。
   * 成否を呼び出し側が知る必要がある経路(backfill スクリプト)はこちらを使う。
   *
   * 戻り値は「実際に埋め込みを書いたか」。本文が空の投稿は書かずに false を返す。
   * これを成功と区別しないと、埋め込みが作られていないのに backfill が
   * success に数えて終了コード 0 で終わってしまう。
   */
  async generateForPostStrict(
    postId: number,
    title: string,
    content: string,
  ): Promise<boolean> {
    const fullText = `${title}\n\n${content}`.trim();
    if (!fullText) return false;
    const text = fullText.slice(0, MAX_TEXT_LEN);

    // 失敗はどの段で落ちたかが分かる文言でここに残し、そのうえで投げ直す。
    // 呼び出し側(飲み込む generateForPost)で一括ログにすると、
    // 旧来の「embed 失敗」「upsert 失敗」という区別が消えてしまう。
    let vector: number[];
    try {
      vector = await this.embed(text, 'RETRIEVAL_DOCUMENT');
    } catch (err) {
      this.logger.error(
        `Failed to embed post ${postId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw err;
    }

    const literal = this.vectorLiteral(vector);
    try {
      await this.prisma.$executeRaw`
        INSERT INTO post_embedding ("postId", "contentText", embedding, "createdAt", "updatedAt")
        VALUES (${postId}, ${text}, ${literal}::vector, NOW(), NOW())
        ON CONFLICT ("postId") DO UPDATE SET
          "contentText" = EXCLUDED."contentText",
          embedding = EXCLUDED.embedding,
          "updatedAt" = NOW()
      `;
    } catch (err) {
      this.logger.error(
        `Failed to upsert embedding for post ${postId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw err;
    }
    return true;
  }

  /**
   * 埋め込みを生成して保存する。失敗はログに残して飲み込む。
   * 投稿の作成・更新を埋め込みの失敗で巻き添えにしない経路はこちらを使う。
   *
   * 戻り値の意味は Strict と同じ(実際に書いたか)。失敗した場合も false を返す。
   * searchSimilar / searchSimilarStrict と同じく、対になる 2 つの違いは
   * 「例外を投げるか、飲み込むか」だけに揃えている。
   * 失敗の記録は Strict 側が段ごとに済ませているため、ここでは重ねて出さない。
   */
  async generateForPost(
    postId: number,
    title: string,
    content: string,
  ): Promise<boolean> {
    try {
      return await this.generateForPostStrict(postId, title, content);
    } catch {
      return false;
    }
  }

  /**
   * 投稿の埋め込みを削除する。非公開化された投稿の本文を残さないために使う。
   * 対象が存在しない場合も正常終了する。
   */
  async deleteForPost(postId: number): Promise<void> {
    try {
      await this.prisma
        .$executeRaw`DELETE FROM post_embedding WHERE "postId" = ${postId}`;
    } catch (err) {
      this.logger.warn(
        `Failed to delete embedding for post ${postId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  /**
   * ベクトル検索。失敗時は例外を投げる。
   * 呼び出し側にエラーを見せたい経路(意味検索UI)はこちらを使う。
   */
  async searchSimilarStrict(
    query: string,
    limit = 5,
  ): Promise<SimilarPostHit[]> {
    const trimmed = query?.trim() ?? '';
    if (!trimmed) return [];
    const text = trimmed.slice(0, MAX_TEXT_LEN);
    // 呼び出し側の値をそのままLIMITに渡さない(全件走査の踏み台にしない)
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT);

    const vector = await this.embed(text, 'RETRIEVAL_QUERY');
    const literal = this.vectorLiteral(vector);
    const rows = await this.prisma.$queryRaw<
      { postId: number; distance: number }[]
    >`
      SELECT pe."postId", (pe.embedding <=> ${literal}::vector)::float8 AS distance
      FROM post_embedding pe
      JOIN post p ON p.id = pe."postId"
      WHERE p."isPublic" = true
      ORDER BY pe.embedding <=> ${literal}::vector
      LIMIT ${safeLimit}
    `;
    return rows.map((r) => ({
      postId: Number(r.postId),
      distance: Number(r.distance),
    }));
  }

  async searchSimilar(query: string, limit = 5): Promise<SimilarPostHit[]> {
    try {
      return await this.searchSimilarStrict(query, limit);
    } catch (err) {
      this.logger.error(
        `Vector search failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return [];
    }
  }

  private aiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.internalToken) {
      headers['X-Internal-Token'] = this.internalToken;
    }
    return headers;
  }

  private async embed(text: string, taskType: string): Promise<number[]> {
    const res = await fetch(`${this.aiServiceUrl}/api/embeddings/`, {
      method: 'POST',
      headers: this.aiHeaders(),
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
