import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  EmbeddingsService,
  SimilarPostHit,
} from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchPostsByLocationDto } from './dto/search-posts-by-location.dto';
import { SearchPostsSemanticDto } from './dto/search-posts-semantic.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  formatPost,
  formatPostWithFavoritesCount,
  postInclude,
  postWithFavoritesCountInclude,
} from './post-format';

// 意味検索で「関連あり」とみなすコサイン類似度の下限。
// text-embedding-3-small の日本語では、無関係な文どうしでも 0.3 台が普通に出る。
// 本番データでの実測は 完全一致クエリ=0.73 / 同じ公園という関連=0.44 /
// 無関係=0.33〜0.36 で、0.40 が「関連あり」と「地の雑音」の境目にあたる。
// この値は埋め込みプロバイダに紐付く。変更・切替の手順と本番での反映方法は
// terraform/envs/prod/terraform.tfvars.example の semantic_min_similarity を参照
// (apply だけでは稼働中のタスクに反映されない)。
const DEFAULT_SEMANTIC_MIN_SIMILARITY = 0.4;

/**
 * 不正な設定値をログに出すための表現を作る。
 * 値をそのまま出すと、別の秘密値を貼り間違えたときに平文で残り、改行を含む値では
 * 偽のログ行を差し込めてしまうため、型・長さ・先頭の数文字だけに留める。
 */
function describeBadConfigValue(raw: unknown): string {
  // 平文化が危ないのは文字列経路だけなので、数値はそのまま出して
  // 「どの値が弾かれたのか」を運用者に残す。
  if (typeof raw === 'number') return String(raw);
  if (typeof raw !== 'string') return typeof raw;
  const head = raw.replace(/\s+/g, ' ').slice(0, 16);
  return `string(len=${raw.length}) "${head}"`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly minSimilarity: number;

  constructor(
    private prisma: PrismaService,
    private embeddingsService: EmbeddingsService,
    configService: ConfigService,
  ) {
    this.minSimilarity = this.resolveMinSimilarity(
      configService.get('SEMANTIC_MIN_SIMILARITY'),
    );
  }

  /**
   * 類似度の下限を環境変数から解決する。
   * 不正値で 0 に落とすと足切りが無言で無効化されるため、既定値へ戻して警告する。
   */
  private resolveMinSimilarity(raw: unknown): number {
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
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      this.logger.warn(
        `SEMANTIC_MIN_SIMILARITY is not a number in [0,1] (got ${describeBadConfigValue(raw)}); falling back to ${DEFAULT_SEMANTIC_MIN_SIMILARITY}`,
      );
      return DEFAULT_SEMANTIC_MIN_SIMILARITY;
    }
    if (parsed === 0) {
      // 0 は「足切りを全部外す」逃げ道として有効値のまま残すが、
      // 事故で 0 が入ると元の不具合(無関係な投稿が10件並ぶ)に静かに戻るため、
      // 無効値と違って正常系でも必ず痕跡を残す。
      this.logger.warn(
        'SEMANTIC_MIN_SIMILARITY=0: 意味検索の足切りは無効です（関連の薄い投稿も返します）',
      );
    }
    return parsed;
  }

  /**
   * 投稿の埋め込みを非同期で同期させる。
   * 非公開投稿は外部AIへ本文を送らず、既存の埋め込みも削除する
   * (post_embedding は可視性を持たないため、行を残さないことで守る)。
   */
  private syncEmbedding(post: {
    id: number;
    title: string;
    content: string;
    isPublic: boolean;
  }): void {
    const task = post.isPublic
      ? this.embeddingsService.generateForPost(
          post.id,
          post.title,
          post.content,
        )
      : this.embeddingsService.deleteForPost(post.id);

    task.catch((err: unknown) => {
      this.logger.error(
        `embedding sync failed for post ${post.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    });
  }

  private async getOrCreateLocation(
    locationName: string,
    // null は「座標なしの行に一致させる」明示値(Prisma は null を IS NULL に落とす)。
    // undefined は「名前のみで検索」。この区別を !== undefined 判定が担っているため、
    // != null に「整理」してはいけない(null 明示のケースが名前のみ一致に化ける)
    latitude?: number | null,
    longitude?: number | null,
    prefecture?: string,
  ) {
    const whereClause = {
      name: locationName,
      ...(latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : {}),
    };

    const existing = await this.prisma.location.findFirst({
      where: whereClause,
    });

    if (existing) return existing;

    try {
      return await this.prisma.location.create({
        data: {
          name: locationName,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          prefecture: prefecture ?? null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const retry = await this.prisma.location.findFirst({
          where: whereClause,
        });
        if (retry) return retry;
      }
      throw err;
    }
  }

  private async getOrCreateTags(tagNames: string[]) {
    const tags = await Promise.all(
      tagNames.map(async (name) => {
        // slugify は記号と区切りを正規化するため異なる name が同じ slug に落ちる
        // ("Kyoto" と "# Kyoto" はどちらも "kyoto")。name だけで引くと衝突を
        // 検出できず tag_slug_key の P2002 で投稿作成ごと 409 になるので、
        // slug 一致でも既存タグを再利用する。orderBy は結果を決定的にするため。
        const slug = slugify(name) || name.toLowerCase();
        const findExisting = () =>
          this.prisma.tag.findFirst({
            where: { OR: [{ name }, { slug }] },
            orderBy: { id: 'asc' },
          });

        const existing = await findExisting();
        if (existing) return existing;

        try {
          return await this.prisma.tag.create({ data: { name, slug } });
        } catch (err) {
          // 検索と create の間に別リクエストが同じタグを作ると
          // tag.name / tag.slug の unique 制約で P2002 になる。
          // competing insert は成功しているので取り直せばよい
          // (getOrCreateLocation と同じ方針)。
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            const retry = await findExisting();
            if (retry) return retry;
          }
          throw err;
        }
      }),
    );
    // slug 一致で再利用する結果、1 リクエスト内の複数の name が同一 Tag 行に
    // 解決されうる。重複を残すと postTag.createMany が同じ (postId, tagId) を
    // 2 件作って @@unique の P2002 で 409 になる。
    const uniqueById = new Map(tags.map((tag) => [tag.id, tag]));
    return [...uniqueById.values()];
  }

  async create(createPostDto: CreatePostDto & { authorId: number }) {
    const {
      tags,
      location: locationName,
      latitude,
      longitude,
      prefecture,
      ...postData
    } = createPostDto;

    let locationId: number | undefined;
    if (locationName) {
      const locationRecord = await this.getOrCreateLocation(
        locationName,
        latitude,
        longitude,
        prefecture,
      );
      locationId = locationRecord.id;
    }

    const tagRecords = tags ? await this.getOrCreateTags(tags) : [];

    const post = await this.prisma.post.create({
      data: {
        title: postData.title,
        content: postData.content,
        imageUrl: postData.imageUrl,
        isPublic: postData.isPublic ?? true,
        authorId: postData.authorId,
        locationId,
        postTags: {
          create: tagRecords.map((tag) => ({ tagId: tag.id })),
        },
      },
      include: postInclude,
    });

    this.syncEmbedding(post);

    return formatPost(post);
  }

  /** limit / offset の検証は OffsetPaginationDto が担う (範囲外は 400)。 */
  async findAll(limit: number = 10, offset: number = 0) {
    const take = limit;
    const skip = offset;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { isPublic: true },
        // favoritesCount を含めないと、カードの BookmarkButton が
        // initialBookmarkCount をそのまま表示するため件数が 0 固定になり、
        // findOne が正しい数を返す詳細画面と食い違う。
        // 集計は bookmark(postId) の索引で引ける。
        include: postWithFavoritesCountInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.post.count({ where: { isPublic: true } }),
    ]);

    return {
      posts: posts.map(formatPostWithFavoritesCount),
      total,
      hasMore: skip + take < total,
    };
  }

  async search(searchPostsDto: SearchPostsDto) {
    const {
      q,
      tags,
      location,
      authorId,
      limit = 10,
      offset = 0,
    } = searchPostsDto;

    const where: Prisma.PostWhereInput = {
      isPublic: true,
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { author: { name: { contains: q, mode: 'insensitive' } } },
        ],
      }),
      ...(tags &&
        tags.length > 0 && {
          postTags: {
            some: {
              tag: {
                name: { in: tags },
              },
            },
          },
        }),
      ...(location && {
        location: {
          name: { contains: location, mode: 'insensitive' },
        },
      }),
      ...(authorId && {
        authorId: authorId,
      }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        // 一覧と同じ理由で favoritesCount を含める (findAll のコメント参照)
        include: postWithFavoritesCountInclude,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      posts: posts.map(formatPostWithFavoritesCount),
      total,
      hasMore: offset + limit < total,
    };
  }

  async findManyByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids }, isPublic: true },
      // 意味検索 (searchSemantic) がここから結果を引く。findAll / search と
      // 同じく favoritesCount を含めないと、同じ /search 画面で
      // キーワード検索は正しい件数・意味検索は 0 固定という食い違いになる。
      include: postWithFavoritesCountInclude,
    });
    return posts.map(formatPostWithFavoritesCount);
  }

  async searchSemantic(dto: SearchPostsSemanticDto) {
    const { q, limit = 10 } = dto;

    let hits: SimilarPostHit[];
    try {
      hits = await this.embeddingsService.searchSimilarStrict(q, limit);
    } catch (err) {
      this.logger.error(
        `Semantic search AI unavailable: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { posts: [], total: 0, hasMore: false, aiAvailable: false };
    }

    if (hits.length === 0) {
      return { posts: [], total: 0, hasMore: false, aiAvailable: true };
    }

    const ids = hits.map((h) => h.postId);
    const hydrated = await this.findManyByIds(ids);
    const byId = new Map(hydrated.map((p) => [p.id, p]));

    const ranked = hits
      .map((hit) => {
        const post = byId.get(hit.postId);
        if (!post) return null;
        const similarity = Math.max(0, 1 - hit.distance);
        return { ...post, similarity };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      // ベクトル検索は「一番マシな上位N件」を必ず返すため、関連する投稿が
      // 一件も無くても無関係な投稿が10件並ぶ。実測では「上野公園だけの投稿を」
      // の1位が 0.46、10位(無関係なねぶた祭)が 0.33 で、差は 0.13 しかない。
      // 利用者から見ると全件ハズレに見えるので、ここで足切りする。
      .filter((p) => p.similarity >= this.minSimilarity);

    return {
      posts: ranked,
      total: ranked.length,
      hasMore: false,
      aiAvailable: true,
    };
  }

  async findOne(id: number, requesterId?: number) {
    const [post, favoritesCount] = await Promise.all([
      this.prisma.post.findUnique({
        where: { id },
        include: postInclude,
      }),
      this.prisma.bookmark.count({ where: { postId: id } }),
    ]);

    if (!post) {
      throw new NotFoundException(`ID ${id} の投稿が見つかりません`);
    }

    // 非公開投稿は投稿者本人のみ閲覧できる。
    // 存在自体を隠すため403ではなく404を返す。
    if (!post.isPublic && post.authorId !== requesterId) {
      throw new NotFoundException(`ID ${id} の投稿が見つかりません`);
    }

    return {
      ...formatPost(post),
      favoritesCount,
    };
  }

  async update(id: number, updatePostDto: UpdatePostDto, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`ID ${id} の投稿が見つかりません`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('自分の投稿のみ編集できます');
    }

    const {
      tags,
      location: locationName,
      latitude,
      longitude,
      prefecture,
      ...postData
    } = updatePostDto;

    // undefined は「場所を触らない」、空文字は「場所を外す」。
    // 空文字を undefined に潰すと、一度設定した場所を二度と外せなくなる。
    let locationId: number | null | undefined;
    if (locationName !== undefined) {
      if (locationName) {
        const location = await this.getOrCreateLocation(
          locationName,
          latitude,
          longitude,
          prefecture,
        );
        locationId = location.id;
      } else {
        locationId = null;
      }
    }

    // タグの解決は削除より前に済ませる。後ろに置くと、解決に失敗した時点で
    // 既存の postTag だけが消えた投稿が残る。tag 行は投稿間で共有され余分に
    // 作られても無害なので、トランザクションの外に出してロック時間も縮める。
    const tagRecords =
      tags !== undefined && tags.length > 0
        ? await this.getOrCreateTags(tags)
        : [];

    const [updatedPost, favoritesCount] = await Promise.all([
      // 張り替えと本体更新を不可分にする。分割すると途中で失敗したときに
      // タグだけ消えた投稿が残る。
      this.prisma.$transaction(async (tx) => {
        if (tags !== undefined) {
          await tx.postTag.deleteMany({ where: { postId: id } });
          if (tagRecords.length > 0) {
            await tx.postTag.createMany({
              data: tagRecords.map((tag) => ({ postId: id, tagId: tag.id })),
            });
          }
        }

        return tx.post.update({
          where: { id },
          data: {
            ...postData,
            ...(locationId !== undefined && { locationId }),
          },
          include: postInclude,
        });
      }),
      this.prisma.bookmark.count({ where: { postId: id } }),
    ]);

    this.syncEmbedding(updatedPost);

    return {
      ...formatPost(updatedPost),
      favoritesCount,
    };
  }

  async remove(id: number, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`ID ${id} の投稿が見つかりません`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('自分の投稿のみ削除できます');
    }

    await this.prisma.post.delete({
      where: { id },
    });
  }

  async searchByLocation(searchDto: SearchPostsByLocationDto) {
    const {
      centerLat,
      centerLng,
      radius = 10,
      limit = 10,
      offset = 0,
      q,
    } = searchDto;

    const searchPattern = q ? `%${q}%` : null;

    interface RawPost {
      id: number;
      title: string;
      content: string;
      imageUrl: string | null;
      isPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
      authorId: number;
      locationId: number | null;
      author_id: number;
      author_name: string;
      author_avatar: string | null;
      location_name: string | null;
      prefecture: string | null;
      latitude: number | null;
      longitude: number | null;
      distance: number | null;
      tags: string[] | null;
      total_count: bigint;
      favorites_count: bigint;
    }

    // 距離式は SELECT と WHERE の両方に現れる。クエリを丸ごと二重に持つと
    // 片方だけ直したときに静かに食い違うため、差分だけを断片にして合成する。
    const distanceExpr =
      centerLat !== undefined && centerLng !== undefined
        ? Prisma.sql`(6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${centerLat})) * cos(radians(l.latitude)) *
              cos(radians(l.longitude) - radians(${centerLng})) +
              sin(radians(${centerLat})) * sin(radians(l.latitude))
            ))
          ))`
        : null;
    const hasGeo = distanceExpr !== null;

    const distanceSelect = distanceExpr
      ? Prisma.sql`${distanceExpr} as distance`
      : Prisma.sql`NULL::float as distance`;
    // 半径での絞り込みと距離順の並びは、距離が算出できる geo 指定時のみ足す
    const radiusFilter = distanceExpr
      ? Prisma.sql`AND ${distanceExpr} <= ${radius}`
      : Prisma.empty;
    const orderBy = distanceExpr
      ? Prisma.sql`ORDER BY distance ASC, p."createdAt" DESC, p.id ASC`
      : Prisma.sql`ORDER BY p."createdAt" DESC, p.id ASC`;

    const rows = await this.prisma.$queryRaw<RawPost[]>`
      SELECT
        p.id, p.title, p.content, p."imageUrl", p."isPublic",
        p."createdAt", p."updatedAt", p."authorId", p."locationId",
        u.id as "author_id", u.name as "author_name", u.avatar as "author_avatar",
        l.name as "location_name", l.prefecture, l.latitude, l.longitude,
        ${distanceSelect},
        COUNT(*) OVER() AS total_count,
        COALESCE(
          (SELECT array_agg(t.name ORDER BY t.name)
           FROM post_tag pt
           JOIN tag t ON pt."tagId" = t.id
           WHERE pt."postId" = p.id),
          ARRAY[]::text[]
        ) as tags,
        -- 一覧系と同じく favoritesCount を返す。含めないと /map のカードだけ
        -- 件数が 0 固定になり、詳細画面と食い違う。
        -- 集計は bookmark(postId) の索引で引ける。
        (SELECT COUNT(*) FROM bookmark b WHERE b."postId" = p.id) AS favorites_count
      FROM post p
      JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN location l ON p."locationId" = l.id
      WHERE p."isPublic" = true
        AND l.latitude IS NOT NULL
        AND l.longitude IS NOT NULL
        ${radiusFilter}
        AND (
          ${searchPattern}::text IS NULL OR (
            p.title ILIKE ${searchPattern} OR
            p.content ILIKE ${searchPattern} OR
            l.name ILIKE ${searchPattern} OR
            u.name ILIKE ${searchPattern}
          )
        )
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const formattedPosts = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      imageUrl: row.imageUrl,
      isPublic: row.isPublic,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
      location: row.location_name,
      prefecture: row.prefecture,
      latitude: row.latitude,
      longitude: row.longitude,
      tags: row.tags ?? [],
      // bigint で返るため Number へ寄せる (total_count と同じ扱い)
      favoritesCount: Number(row.favorites_count),
      author: {
        id: row.author_id,
        name: row.author_name,
        avatar: row.author_avatar,
      },
      ...(hasGeo && { distance: row.distance ?? undefined }),
    }));

    return {
      posts: formattedPosts,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getTags() {
    const tags = await this.prisma.tag.findMany({
      include: {
        _count: {
          select: { postTags: true },
        },
      },
      orderBy: {
        postTags: {
          _count: 'desc',
        },
      },
    });

    const filteredTags = tags.filter((tag) => tag._count.postTags > 0);

    return {
      tags: filteredTags.map((tag) => ({
        name: tag.name,
        slug: tag.slug,
        count: tag._count.postTags,
      })),
      total: filteredTags.length,
    };
  }

  async getLocations() {
    const locations = await this.prisma.location.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: {
        posts: {
          _count: 'desc',
        },
      },
    });

    // total は返した件数と一致させる。フィルタ前の件数を返すと
    // 投稿0件の location の分だけ水増しされ、getTags と挙動も食い違う。
    const filteredLocations = locations.filter((loc) => loc._count.posts > 0);

    return {
      locations: filteredLocations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        prefecture: loc.prefecture,
        latitude: loc.latitude,
        longitude: loc.longitude,
        count: loc._count.posts,
      })),
      total: filteredLocations.length,
    };
  }
}
