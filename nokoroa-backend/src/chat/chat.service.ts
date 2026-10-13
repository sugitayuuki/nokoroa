import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { resolveSemanticMinSimilarity } from '../embeddings/semantic-threshold';
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

// AI へ渡す関連投稿の上限。各段の検索もこの数で打ち切る。
const MAX_CONTEXT_POSTS = 5;
// イベント境界(空行)待ちで保持する長さの上限。上流が空行を一度も送らない
// 壊れ方をすると、これが無いとストリーム全体を抱え込む。
const MAX_FRAME_BUFFER_CHARS = 100_000;
// 採用する申告 id の上限。候補は5件なので、それ以上は壊れた出力とみなす。
// 上流が壊れて大量に送ってきても、こちらで抱え込まないための歯止め。
const MAX_USED_POSTS = 10;

// AIサービスが「本文で触れた投稿」を申告するコメント行。
// 値を変える場合は nokoroa-ai/app/routers/chat.py と同時に変更すること。
const USED_POSTS_COMMENT = ':used_posts ';

/**
 * AIサービスが申告した id を、SSE の1イベントから取り出す。
 *
 * 申告は**コメント行**(`:` 始まり)で届く。生成テキストは全行に `data: ` が
 * 付くため、本文が申告を名乗ることが構造的にできない。`data:` に載せて
 * JSON の中身だけで判定すると、AIが本文として同じ JSON を1行出しただけで
 * 正規の申告とバイト列が一致し、カードの選択を本文経由で操作できてしまう。
 * コメント行はどのクライアントも本文として扱わないため、旧い frontend にも
 * 生の JSON が表示されない。
 */
function usedPostIdsOf(event: string): number[] {
  const line = event
    .split('\n')
    .find((candidate) => candidate.startsWith(USED_POSTS_COMMENT));
  if (line === undefined) return [];

  try {
    const parsed = JSON.parse(line.slice(USED_POSTS_COMMENT.length)) as {
      ids?: unknown;
    };
    if (!Array.isArray(parsed.ids)) return [];
    return parsed.ids
      .filter((id): id is number => Number.isInteger(id))
      .slice(0, MAX_USED_POSTS);
  } catch {
    return [];
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly aiServiceUrl: string;
  private readonly internalToken: string;
  /** RAG の候補を「関連あり」とみなす下限。意味検索と同じ値を使う */
  private readonly minSimilarity: number;

  constructor(
    private configService: ConfigService,
    private postsService: PostsService,
    private embeddingsService: EmbeddingsService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8000';
    this.minSimilarity = resolveSemanticMinSimilarity(
      this.configService.get('SEMANTIC_MIN_SIMILARITY'),
      this.logger,
    );
    // 意味検索と同じ値だが、チャットにも効いていることはこの 1 行が無いと
    // ログからは読み取れない(閾値を動かす人が影響範囲を見誤る)。
    this.logger.log(`RAG min similarity: ${this.minSimilarity}`);
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

    // DB 検索が落ちても、拾えていたベクトル候補まで捨てないよう try の外に置く。
    let posts: FormattedPost[] = [];
    // 下限に届かなかったベクトル候補。意味的に近いものが 1 件も無いときの埋め草。
    let weakVectorHits: FormattedPost[] = [];
    let hasRelatedVectorHit = false;
    // 単語分割の部分一致で拾った候補。「教えて」「おすすめ」のような汎用語が
    // 本文に当たっただけのものを含むため、埋め草と同じく「関連あり」の根拠には
    // しない(AI へは渡す。使ったなら申告で返ってくる)。
    const weakKeywordIds = new Set<number>();

    try {
      // ベクトル検索だけは外部の埋め込みAPIに依存する。ここの失敗を
      // 外へ投げると、外部APIを一切使わない下のDB検索まで巻き添えで
      // 飛ばされ、プロバイダ障害時に関連投稿が完全に出なくなる。
      // ヒット0件と同じ扱いにしてフォールバックへ進ませる。
      try {
        const vector = await this.searchByVector(
          dto.message,
          MAX_CONTEXT_POSTS,
        );
        posts = vector.related;
        weakVectorHits = vector.weak;
        hasRelatedVectorHit = vector.related.length > 0;
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
              weakKeywordIds.add(p.id);
            }
          }
          if (posts.length >= 5) break;
        }
        if (posts.length > 5) posts.length = 5;
      }
    } catch (error) {
      this.logger.error(
        `Failed to search related posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // 意味的に十分近い候補が 1 件も無かったときに限り、下限未満のベクトル候補で
    // 空いている枠を埋める。
    //
    // 「全滅したときだけ使う」にすると、後段が 1 件でも拾った時点で捨てられる。
    // 単語分割は「おすすめ」「教えてください」のような汎用語にも当たるため、
    // 「箱根で温泉のおすすめを教えてください」では類似度 0.38 の温泉の投稿が
    // 捨てられ、"おすすめ" に当たっただけの無関係な新着 1 件だけが AI へ渡る。
    // それは足切りを入れる前より悪い。後段の結果を先に並べたうえで、
    // 余った枠にだけ回す(DB 検索が例外で落ちた場合もここへ来る)。
    //
    // 逆に下限以上の候補が取れているときは足さない。雑音を混ぜる理由が無く、
    // それをやると足切りの意味が消える。
    if (
      !hasRelatedVectorHit &&
      posts.length < MAX_CONTEXT_POSTS &&
      weakVectorHits.length > 0
    ) {
      const seen = new Set(posts.map((p) => p.id));
      for (const post of weakVectorHits) {
        if (posts.length >= MAX_CONTEXT_POSTS) break;
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        posts.push(post);
      }
    }

    // 候補が根拠の弱いものだけ、つまりどの手段でも「関連あり」と言える根拠が
    // 得られなかった状態か。カードを出すかどうかの判断に使う。
    // 弱い根拠は 2 種類: 下限未満のベクトル候補(埋め草)と、単語分割の部分一致。
    // メッセージ全体の一致は利用者の言葉がそのまま載っている投稿なので強いまま。
    const weakIds = new Set([
      ...weakVectorHits.map((p) => p.id),
      ...weakKeywordIds,
    ]);
    const contextIsWeakOnly =
      posts.length > 0 && posts.every((p) => weakIds.has(p.id));

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
      for (const event of events) {
        const ids = usedPostIdsOf(event);
        // 申告は最後のものだけを採る。AIサービス側も末尾の申告だけを送るが、
        // 壊れた上流から複数届いても無制限に積まないようにする。
        if (ids.length > 0) usedPostIds.splice(0, usedPostIds.length, ...ids);
      }
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
      // 最後のイベントが空行で閉じずに終わった場合 (接続断など) の取りこぼし。
      // 捨てると、本文は特定の投稿だけを語っているのにカードは全件、という
      // 食い違いになる。
      const lastIds = usedPostIdsOf(frameBuffer + decoder.decode());
      if (lastIds.length > 0) {
        usedPostIds.splice(0, usedPostIds.length, ...lastIds);
      }

      const related = this.resolveRelatedPosts(
        relatedPostsRaw,
        usedPostIds,
        contextIsWeakOnly,
      );
      if (related.length > 0 && !res.destroyed) {
        // 制御イベントには名前を付ける。本文は全行に data: が付くため
        // event 行を作れず、本文がカード差し替えを名乗れなくなる。
        // payload の type は、名前を見ない旧 frontend との互換のために残す。
        res.write(
          `event: related_posts\ndata: ${this.relatedPostsEvent(related)}\n\n`,
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
  private resolveRelatedPosts(
    posts: FormattedPost[],
    usedPostIds: number[],
    contextIsWeakOnly: boolean,
  ): FormattedPost[] {
    const used = new Set(usedPostIds);
    const mentioned = posts.filter((post) => used.has(post.id));
    if (mentioned.length > 0) return mentioned;

    // 申告が無い / 候補と1件も一致しないのは、AIが投稿に触れずに答えた場合か
    // 申告が壊れた場合。後者と区別できないので、原則は従来どおり全件返す。
    //
    // ただし候補が全て根拠の弱いもの(下限未満の埋め草か、単語分割の部分一致)
    // だったなら話が別で、「関連と言える根拠が無い」「AIも使わなかった」の
    // 二つが揃っている。実際「確定申告の書き方を教えて」に AI が『旅行の
    // 相談にお答えする役割です』と断ったうえで、"教えて" が本文に当たった
    // 1 件を足がかりに埋め草ごと 5 件が「関連する投稿」として並んでいた。
    // この場合だけカードを出さない。
    if (contextIsWeakOnly) return [];
    return posts;
  }

  private relatedPostsEvent(posts: FormattedPost[]): string {
    return JSON.stringify({ type: 'related_posts', posts });
  }

  /**
   * ベクトル検索の結果を、類似度の下限で 2 つに分けて返す。
   *
   * ベクトル検索は関連する投稿が一件も無くても「一番マシな上位N件」を必ず返す。
   * それをそのまま候補にすると、後段のキーワード検索・単語分割検索へ永久に
   * 到達しなくなる。実際「ピエールの投稿」は単語分割まで進めば著者名で
   * ヒットするのに、無関係な投稿が 2 件返るせいで AI には「該当なし」として
   * 渡っていた(著者名は埋め込み対象の本文に含まれないため、ベクトル検索だけでは
   * 構造的に拾えない)。
   */
  private async searchByVector(
    query: string,
    limit: number,
  ): Promise<{ related: FormattedPost[]; weak: FormattedPost[] }> {
    const hits = await this.embeddingsService.searchSimilar(query, limit);
    if (hits.length === 0) return { related: [], weak: [] };

    const ids = hits.map((h) => h.postId);
    const posts = await this.postsService.findManyByIds(ids);
    const byId = new Map(posts.map((p) => [p.id, p]));

    const related: FormattedPost[] = [];
    const weak: FormattedPost[] = [];
    let best = 0;
    for (const hit of hits) {
      const post = byId.get(hit.postId);
      if (!post) continue;
      const similarity = Math.max(0, 1 - hit.distance);
      best = Math.max(best, similarity);
      (similarity >= this.minSimilarity ? related : weak).push(post);
    }

    if (related.length === 0 && weak.length > 0) {
      // 閾値がチャットの入力(検索クエリより長い会話文)に対して厳しすぎないかは、
      // 最高類似度の分布が分からないと判断できない。一部だけ落ちたケースは
      // 候補が残るので鳴らさず、全部落ちたときだけ残す。
      // クエリ本文は利用者のデータなので出さない。
      // 件数は実際に比べた数を使う。hits には非公開化・削除で引けなかった分が
      // 混じるため、そちらを出すとログと判定がずれる。
      this.logger.log(
        `Chat vector search: none of ${weak.length} reached ${this.minSimilarity} (best=${best.toFixed(2)})`,
      );
    }
    return { related, weak };
  }
}
