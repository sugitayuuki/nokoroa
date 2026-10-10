import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { FormattedPost } from '../posts/post-format';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';
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

// 投稿者を名指しした質問かどうかの判定語。これが無い文でも利用者名は
// 偶然含まれうる(地名と同じ名前など)ため、意図が明示されている場合に限って
// 著者で絞り込む。
const AUTHOR_SCOPE_INTENT = /投稿|記事|ポスト/;
// 著者名の直後に来る語。「ピエールさんの投稿」の「さん」、
// 「アレックスの投稿」の「の」にあたる。
const AUTHOR_NAME_FOLLOWER = /^(?:さん|サン|くん|君|ちゃん|様|さま|氏|の)/;
// 1文字の名前はどんな文にも偶然含まれるため、著者解決の対象から外す。
const MIN_AUTHOR_NAME_LENGTH = 2;
// メッセージに部分一致する利用者をDBから取り出す上限。
const AUTHOR_CANDIDATE_LIMIT = 10;

/**
 * message 中に name が現れ、その直後が敬称または「の」であるかを判定する。
 * 大小文字を無視するため、添字がずれないよう小文字化した側だけで走査する。
 */
function isAuthorReference(message: string, name: string): boolean {
  const haystack = message.toLowerCase();
  const needle = name.toLowerCase();
  if (needle.length === 0) return false;

  for (let from = 0; from <= haystack.length; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    if (AUTHOR_NAME_FOLLOWER.test(haystack.slice(at + needle.length))) {
      return true;
    }
    from = at + 1;
  }
  return false;
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
    private prisma: PrismaService,
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
      title: string;
      content: string;
      location: string;
      author: string;
    }> = [];
    let relatedPostsRaw: FormattedPost[] = [];

    try {
      let posts: FormattedPost[] = [];

      // 「〇〇さんの投稿」と名指しされた場合は、その投稿者だけに絞る。
      // 著者解決に失敗しても通常の検索は動くので、絞り込みなしで続行する。
      let authorScope: { id: number; name: string } | null = null;
      try {
        authorScope = await this.resolveAuthorScope(dto.message);
      } catch (error) {
        this.logger.warn(
          `Author scope resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      if (authorScope) {
        // ヒット0件でも下の検索へ落とさない。落とすと、名指しされていない
        // 投稿者の投稿が関連投稿カードに並び、名指しの意図を裏切る。
        const byAuthor = await this.postsService.search({
          authorId: authorScope.id,
          limit: 5,
          offset: 0,
        });
        posts = byAuthor.posts;
      } else {
        // ベクトル検索だけは外部の埋め込みAPIに依存する。ここの失敗を
        // 外へ投げると、外部APIを一切使わない下のDB検索まで巻き添えで
        // 飛ばされ、プロバイダ障害時に関連投稿が完全に出なくなる。
        // ヒット0件と同じ扱いにしてフォールバックへ進ませる。
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
      }

      if (posts.length > 0) {
        relatedPostsRaw = posts;
        contextPosts = posts.map((post) => ({
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
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // 切断後に write すると ERR_STREAM_DESTROYED になる
        if (res.destroyed) break;
        res.write(Buffer.from(value));
      }
      if (relatedPostsRaw.length > 0 && !res.destroyed) {
        const relatedPostsEvent = JSON.stringify({
          type: 'related_posts',
          posts: relatedPostsRaw,
        });
        res.write(`data: ${relatedPostsEvent}\n\n`);
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
   * 「ピエールさんの投稿が見たい」のように投稿者を名指しした質問から、
   * その投稿者を特定する。該当しなければ null(通常の検索へ戻す)。
   *
   * メッセージ全文を q として渡す既存の検索では author.name の部分一致が
   * 成立しない(name contains 'ピエールさんの投稿が見たい' になる)。
   * そのためここでは文から名前を切り出すのではなく、登録済みの name が
   * メッセージに含まれるかをDB側で判定する(敬称の有無に依存しない)。
   */
  private async resolveAuthorScope(
    message: string,
  ): Promise<{ id: number; name: string } | null> {
    if (!AUTHOR_SCOPE_INTENT.test(message)) return null;

    // name は索引が無く %LIKE% も使えないため position() で走査する。
    // message は DTO 側で 2000 文字に制限済み。
    const candidates = await this.prisma.$queryRaw<
      Array<{ id: number; name: string }>
    >`
      SELECT id, name FROM "user"
      WHERE char_length(name) >= ${MIN_AUTHOR_NAME_LENGTH}
        AND position(lower(name) in lower(${message})) > 0
      ORDER BY char_length(name) DESC
      LIMIT ${AUTHOR_CANDIDATE_LIMIT}
    `;

    const named = candidates.filter((user) =>
      isAuthorReference(message, user.name),
    );
    if (named.length === 0) return null;

    // 「ピエール」と「ピエール・デュボワ」が両方一致する場合は長い方が意図に近い。
    const longest = Math.max(...named.map((user) => user.name.length));
    const top = named.filter((user) => user.name.length === longest);

    // 同名の別人が居る場合はどちらか決められない。誤った1人に絞るより、
    // 絞り込みを諦めて通常の検索へ戻す方が害が小さい。
    return top.length === 1 ? top[0] : null;
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
