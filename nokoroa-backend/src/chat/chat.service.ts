import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { FormattedPost } from '../posts/post-format';
import { PostsService } from '../posts/posts.service';
import {
  ChatRequestDto,
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_HISTORY_TOTAL_LENGTH,
} from './dto/chat-request.dto';
import { SuggestionsRequestDto } from './dto/suggestions-request.dto';

/**
 * 文字列を指定長で切り詰める。境界が絵文字などのサロゲートペアの途中に
 * 落ちた場合は1コードユニット余分に削る。
 * 孤立サロゲートを残すと、受け側(Python)でUTF-8エンコードに失敗する。
 */
function sliceSafely(text: string, maxLength: number): string {
  const cut = text.slice(0, maxLength);
  if (cut.length === 0) return cut;

  const lastUnit = cut.charCodeAt(cut.length - 1);
  const isLoneHighSurrogate = lastUnit >= 0xd800 && lastUnit <= 0xdbff;

  return isLoneHighSurrogate ? cut.slice(0, -1) : cut;
}

const AI_REQUEST_TIMEOUT_MS = 10_000;
const AI_STREAM_TIMEOUT_MS = 60_000;
// 検索ヒット0件時のキーワード分割フォールバックで走査する最大単語数。
// 上限が無いと1リクエストで単語数ぶんのDB検索が直列実行される。
const MAX_FALLBACK_KEYWORDS = 5;
// イベント境界(空行)待ちで保持する長さの上限。上流が空行を一度も送らない
// 壊れ方をすると、これが無いとストリーム全体を抱え込む。
const MAX_FRAME_BUFFER_CHARS = 100_000;

/**
 * AIサービスが「本文で触れた投稿」として申告した id を、SSE の1イベントから
 * 取り出す。形式は nokoroa-ai/app/routers/chat.py の used_posts イベント。
 *
 * 本文のイベントは data 行に生成テキストがそのまま載るため、JSON として
 * 読めない / type が違うものは無視する。
 */
function usedPostIdsOf(event: string): number[] {
  // SSEは1イベントが複数の data: 行を持ちうる。仕様どおり改行で結合する。
  const dataLines = event
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6));
  if (dataLines.length === 0) return [];

  const data = dataLines.join('\n');
  if (!data.startsWith('{')) return [];

  try {
    const parsed = JSON.parse(data) as { type?: unknown; ids?: unknown };
    if (parsed.type !== 'used_posts' || !Array.isArray(parsed.ids)) return [];
    return parsed.ids.filter((id): id is number => Number.isInteger(id));
  } catch {
    return [];
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly aiServiceUrl: string;
  private readonly internalToken: string;

  constructor(
    private configService: ConfigService,
    private postsService: PostsService,
    private embeddingsService: EmbeddingsService,
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
   * AIへ転送する会話履歴を上限まで切り詰める。
   * DTOの上限は「拒否」でしかないため、実際に外部へ送る量はここで抑える
   * (クライアントの善意に依存しない)。
   */
  private trimHistory(
    history: ChatRequestDto['history'],
  ): ChatRequestDto['history'] {
    if (!history) return [];

    // DTOの上限(20件 × 8000文字)は「拒否」の境界なので、そのままだと
    // 1リクエストで16万文字を外部AIへ転送できてしまう。
    // 新しいターンから総文字数のバジェットを積み、超えた時点で打ち切る。
    // 直近の会話はそのまま残り、古いターンから落ちる。
    const trimmed: NonNullable<ChatRequestDto['history']> = [];
    let budget = MAX_HISTORY_TOTAL_LENGTH;

    for (const msg of history.slice(-MAX_HISTORY_ITEMS).reverse()) {
      if (budget <= 0) break;
      const content = sliceSafely(
        msg.content,
        Math.min(budget, MAX_HISTORY_CONTENT_LENGTH),
      );
      budget -= content.length;
      trimmed.unshift({ ...msg, content });
    }

    return trimmed;
  }

  /** AIサービスは内部呼び出しのみを受け付けるため、全リクエストに内部トークンを付ける */
  private aiHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Token': this.internalToken,
    };
  }

  async streamChat(dto: ChatRequestDto, res: Response): Promise<void> {
    let contextPosts: Array<{
      id: number;
      title: string;
      content: string;
      location: string;
      author: string;
    }> = [];
    let relatedPostsRaw: FormattedPost[] = [];

    try {
      // ベクトル検索だけは外部の埋め込みAPIに依存する。ここの失敗を
      // 外へ投げると、外部APIを一切使わない下のDB検索まで巻き添えで
      // 飛ばされ、プロバイダ障害時に関連投稿が完全に出なくなる。
      // ヒット0件と同じ扱いにしてフォールバックへ進ませる。
      let posts: FormattedPost[] = [];
      try {
        posts = await this.searchByVector(dto.message, 5);
      } catch (error) {
        this.logger.warn(
          `Vector search unavailable, falling back to keyword search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      if (posts.length === 0) {
        const searchResult = await this.postsService.search({
          q: dto.message,
          limit: 5,
          offset: 0,
        });
        posts.push(...searchResult.posts);
      }

      if (posts.length === 0) {
        const allWords = dto.message
          .split(/[\s\u3000,、。のはがをでにへともより]+/)
          .filter((w) => w.length >= 2);
        // 重複を除いたうえで上限まで。入力語数に比例してDB検索が増えるのを防ぐ。
        const words = [...new Set(allWords)].slice(0, MAX_FALLBACK_KEYWORDS);
        const seen = new Set<number>();
        for (const word of words) {
          const wordResult = await this.postsService.search({
            q: word,
            limit: 5,
            offset: 0,
          });
          for (const p of wordResult.posts) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              posts.push(p);
            }
          }
          if (posts.length >= 5) break;
        }
        if (posts.length > 5) posts.length = 5;
      }

      if (posts.length > 0) {
        relatedPostsRaw = posts;
        contextPosts = posts.map((post) => ({
          // AIはこの id で「本文で触れた投稿」を申告する。申告された id は
          // ここで送った候補と突き合わせてから使う (relatedPostsEvent)。
          id: post.id,
          title: post.title,
          content: post.content,
          location: post.location ?? '',
          author: post.author.name,
        }));
      }
    } catch (error) {
      this.logger.error(
        `Failed to search related posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // クライアントが切断したら上流 (AIサービス → Gemini) も畳む。
    // これが無いとタブを閉じた後も生成が最後まで走り、課金され続ける。
    const clientGone = new AbortController();
    res.on('close', () => clientGone.abort());

    let response: globalThis.Response;
    try {
      response = await fetch(`${this.aiServiceUrl}/api/chat/stream`, {
        method: 'POST',
        headers: this.aiHeaders(),
        body: JSON.stringify({
          message: dto.message,
          history: this.trimHistory(dto.history),
          context_posts: contextPosts,
        }),
        signal: AbortSignal.any([
          clientGone.signal,
          AbortSignal.timeout(AI_STREAM_TIMEOUT_MS),
        ]),
      });
    } catch (err) {
      // 切断が先に起きた場合はエラーではないので、レスポンスも触らない
      if (clientGone.signal.aborted) return;
      this.logger.error(
        `AI chat fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      res.status(502).json({ error: 'AI service unreachable' });
      return;
    }

    if (!response.ok || !response.body) {
      res.status(response.status).json({ error: 'AI service request failed' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    // AIが申告した「本文で触れた投稿」の id を拾う。ストリームは素通しのまま
    // 読むだけで、クライアントへ送るバイト列は変えない。
    const decoder = new TextDecoder();
    let frameBuffer = '';
    const usedPostIds: number[] = [];

    const collectUsedPosts = (chunk: Uint8Array): void => {
      frameBuffer += decoder.decode(chunk, { stream: true });
      const events = frameBuffer.split('\n\n');
      frameBuffer = events.pop() ?? '';
      for (const event of events) usedPostIds.push(...usedPostIdsOf(event));
      if (frameBuffer.length > MAX_FRAME_BUFFER_CHARS) frameBuffer = '';
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // 切断後に write すると ERR_STREAM_DESTROYED になる
        if (res.destroyed) break;
        res.write(Buffer.from(value));
        collectUsedPosts(value);
      }

      if (relatedPostsRaw.length > 0 && !res.destroyed) {
        res.write(
          `data: ${this.relatedPostsEvent(relatedPostsRaw, usedPostIds)}\n\n`,
        );
      }
    } catch (err) {
      // 切断・タイムアウトによる中断は異常ではない。ヘッダは送出済みで
      // ステータスを変えられないため、ログに残して終了する。
      this.logger.warn(
        `AI chat stream interrupted: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      // 上流の body を明示的に閉じる。放置すると AI サービス側の
      // ストリームが残り Gemini の生成が続く。
      await reader.cancel().catch(() => undefined);
      if (!res.writableEnded) res.end();
    }
  }

  async getSuggestions(dto: SuggestionsRequestDto): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/chat/suggestions`,
        {
          method: 'POST',
          headers: this.aiHeaders(),
          body: JSON.stringify({
            message: dto.message,
            ai_response: dto.ai_response,
          }),
          signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { suggestions?: string[] };
      return data.suggestions ?? [];
    } catch (error) {
      this.logger.warn(
        `Failed to get suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * 関連投稿カードとして送る SSE イベントを組み立てる。
   *
   * 検索でヒットした投稿をそのまま並べると本文と食い違う。「ピエールさんの
   * 投稿が見たい」に対し、AIは渡された候補の中からピエールの投稿だけを選んで
   * 答えるのに、カードには候補5件(= 別人の投稿を含む)がそのまま出ていた。
   *
   * 絞り込みの根拠は、AIが申告した id だけを使う。題名や本文の文字列照合に
   * すると、題名は利用者が自由に決められるため「AIが必ず口にする定型文を
   * 題名にして、他人の投稿をカードから追い出す」経路ができる。
   * id は backend が採番したもので、ここで送った候補と突き合わせるため、
   * 申告をどう細工されても候補集合の外へは出られない。
   */
  private relatedPostsEvent(
    posts: FormattedPost[],
    usedPostIds: number[],
  ): string {
    const used = new Set(usedPostIds);
    const mentioned = posts.filter((post) => used.has(post.id));

    return JSON.stringify({
      type: 'related_posts',
      // 申告が無い / 候補と1件も一致しないのは、AIが投稿に触れずに答えた場合か
      // 申告が壊れた場合。絞り込む根拠が無いので従来どおり全件返す。
      posts: mentioned.length > 0 ? mentioned : posts,
    });
  }

  private async searchByVector(
    query: string,
    limit: number,
  ): Promise<FormattedPost[]> {
    const hits = await this.embeddingsService.searchSimilar(query, limit);
    if (hits.length === 0) return [];

    const ids = hits.map((h) => h.postId);
    const posts = await this.postsService.findManyByIds(ids);
    const byId = new Map(posts.map((p) => [p.id, p]));

    const found: FormattedPost[] = [];
    for (const hit of hits) {
      const post = byId.get(hit.postId);
      if (post) found.push(post);
    }
    return found;
  }
}
