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

// 投稿を求めている質問かどうかの判定語。敬称付きの名前は依頼文にも出る
// (「田中さんに教わった京都の店」)ため、投稿を指す語がある場合に限って
// 著者で絞り込む。
const AUTHOR_SCOPE_INTENT = /投稿|記事|ポスト/;
// 名前の直後に置かれる敬称。敬称を必須にすることで、地名や一般名詞と同じ
// 表示名(name に一意制約は無く本人が自由に変更できる)を登録して
// 「京都の投稿」のような質問の検索結果を乗っ取る経路を塞ぐ。
// 代償として敬称の無い「〇〇の投稿」は拾えない(従来どおりの検索に落ちる)。
const AUTHOR_HONORIFIC = /さん|サン|くん|君|ちゃん|様|さま|氏/g;
// 敬称の手前から左へ何区切りまで遡って候補を作るか。
const MAX_NAME_SEGMENTS = 4;
// 候補として認める名前の長さ。これを超える切り出しは名前ではない。
const MAX_AUTHOR_NAME_LENGTH = 50;
// 1メッセージから作る候補の上限。2000文字の長文で候補が際限なく増えるのを防ぐ。
const MAX_AUTHOR_CANDIDATES = 12;
// 同時に絞り込む投稿者の上限。「AさんとBさんの投稿」までを想定する。
const MAX_SCOPED_AUTHORS = 3;

// 名前の切れ目。ここに当たったら候補の延長を止める。
const NAME_DELIMITER = /[\s\u3000、。,.!?！？「」『』【】()（）[\]:：;；"'`]/;
const SPACE = /[\s\u3000]/;
const KANJI = /[々一-鿿]/;
// 「ー」「・」はカタカナ名の一部なのでカタカナ側に含める。
const KATAKANA = /[ァ-ヺ・ー]/;
const HIRAGANA = /[ぁ-ゖ]/;
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/;

function scriptOf(char: string): string {
  if (KANJI.test(char)) return 'kanji';
  if (KATAKANA.test(char)) return 'katakana';
  if (HIRAGANA.test(char)) return 'hiragana';
  if (ALNUM.test(char)) return 'alnum';
  return 'other';
}

/** text.slice(0, end) の末尾にある区切りの開始位置を返す */
function segmentStart(text: string, end: number): number {
  const last = text[end - 1];

  if (NAME_DELIMITER.test(last)) {
    // 「裕貴 杉田さん」のように姓名が空白で割れている場合だけ空白を飲み込む。
    // 句読点や括弧は名前の外なのでそこで打ち切る。
    if (!SPACE.test(last)) return end;
    let i = end - 1;
    while (i > 0 && SPACE.test(text[i - 1])) i--;
    return i;
  }

  const script = scriptOf(last);
  let i = end - 1;
  while (i > 0 && scriptOf(text[i - 1]) === script) i--;
  return i;
}

/**
 * 敬称の直前から左へ遡って表示名の候補を切り出す。
 *
 * 文字種(漢字 / カタカナ / ひらがな / 英数)が変わる位置を名前の切れ目と
 * みなす。「今日はピエールさん」なら「ピエール」、「健太郎さん」なら
 * 「健太郎」が得られる。候補は後段で表示名と**完全一致**したものだけを
 * 採用するため、これは「利用者名がメッセージに含まれるか」を部分一致で
 * 見た場合の誤爆(「健太郎さん」が利用者「太郎」に解決される)を防ぐ
 * 境界判定を兼ねている。
 */
function authorNameCandidates(message: string): string[] {
  const candidates = new Set<string>();

  for (const match of message.matchAll(AUTHOR_HONORIFIC)) {
    if (candidates.size >= MAX_AUTHOR_CANDIDATES) break;

    const head = message.slice(0, match.index);
    let start = head.length;

    for (let segment = 0; segment < MAX_NAME_SEGMENTS && start > 0; segment++) {
      const next = segmentStart(head, start);
      if (next === start) break;
      start = next;

      const candidate = head.slice(start).trim();
      if (candidate.length === 0) continue;
      if (candidate.length > MAX_AUTHOR_NAME_LENGTH) break;
      candidates.add(candidate);
    }
  }

  return [...candidates];
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
      let scopedAuthors: Array<{ id: number; name: string }> = [];
      try {
        scopedAuthors = await this.resolveScopedAuthors(dto.message);
      } catch (error) {
        this.logger.warn(
          `Author scope resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      if (scopedAuthors.length > 0) {
        // ヒット0件でも下の検索へ落とさない。落とすと、名指しされていない
        // 投稿者の投稿が関連投稿カードに並び、名指しの意図を裏切る。
        const seen = new Set<number>();
        for (const author of scopedAuthors) {
          const byAuthor = await this.postsService.search({
            authorId: author.id,
            limit: 5,
            offset: 0,
          });
          for (const p of byAuthor.posts) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              posts.push(p);
            }
          }
        }
        // 複数人を名指しされた場合、1人目だけで5件を埋めてしまわないよう
        // 全員ぶんを新しい順に並べ直してから切り詰める。
        posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (posts.length > 5) posts.length = 5;
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
  private async resolveScopedAuthors(
    message: string,
  ): Promise<Array<{ id: number; name: string }>> {
    if (!AUTHOR_SCOPE_INTENT.test(message)) return [];

    const candidates = authorNameCandidates(message);
    if (candidates.length === 0) return [];

    // 公開投稿を持つ利用者だけを候補にする。これが無いと「公開投稿が0件の
    // 利用者がその表示名で登録されているか」を応答の差(関連投稿が出るか
    // 出ないか)から判別でき、在籍確認の手段になる。
    //
    // name は候補との完全一致で引くが、等価比較に使える索引は無いので
    // user の全件走査になる(user_name_trgm_idx は ILIKE 用で等価には
    // 効かない)。候補は十数件の短い文字列なので、走査は行数のみに比例する。
    const authors = await this.prisma.$queryRaw<
      Array<{ id: number; name: string }>
    >`
      SELECT u.id, u.name
      FROM "user" u
      WHERE EXISTS (
              SELECT 1
              FROM unnest(${candidates}::text[]) AS candidate(value)
              WHERE lower(u.name) = lower(candidate.value)
            )
        AND EXISTS (
              SELECT 1 FROM "post" p
              WHERE p."authorId" = u.id AND p."isPublic" = true
            )
      ORDER BY u.id
      LIMIT ${MAX_SCOPED_AUTHORS + 1}
    `;

    // 対象が広がりすぎた場合は名指しとして扱わない(通常の検索の方が
    // 意図に近い)。1件多く取っているのは、超過を検知するため。
    return authors.length > MAX_SCOPED_AUTHORS ? [] : authors;
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
