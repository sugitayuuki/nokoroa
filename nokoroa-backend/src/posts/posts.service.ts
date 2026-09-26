import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { publicAuthorSelect } from '../common/public-author.select';
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

const MAX_PAGE_SIZE = 50;

/** 数値でない値・範囲外の値を安全な既定値に丸める */
function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const postInclude = {
  author: {
    select: publicAuthorSelect,
  },
  location: true,
  postTags: {
    include: {
      tag: true,
    },
  },
};

interface PostWithRelations {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: number;
  locationId: number | null;
  author: {
    id: number;
    name: string;
    avatar: string | null;
  };
  location: {
    id: number;
    name: string;
    country: string;
    prefecture: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
  } | null;
  postTags: {
    id: number;
    postId: number;
    tagId: number;
    tag: {
      id: number;
      name: string;
      slug: string;
    };
  }[];
}

function formatPost(post: PostWithRelations) {
  return {
    ...post,
    tags: post.postTags.map((pt) => pt.tag.name),
    // ?? を使う。|| だと緯度0(赤道)・経度0(本初子午線)・空文字が null に潰れる
    location: post.location?.name ?? null,
    latitude: post.location?.latitude ?? null,
    longitude: post.location?.longitude ?? null,
    prefecture: post.location?.prefecture ?? null,
  };
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingsService: EmbeddingsService,
  ) {}

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
    latitude?: number,
    longitude?: number,
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
        const existing = await this.prisma.tag.findUnique({ where: { name } });
        if (existing) return existing;

        try {
          return await this.prisma.tag.create({
            data: {
              name,
              slug: slugify(name) || name.toLowerCase(),
            },
          });
        } catch (err) {
          // findUnique と create の間に別リクエストが同じタグを作ると
          // tag.name / tag.slug の unique 制約で P2002 になる。
          // competing insert は成功しているので取り直せばよい
          // (getOrCreateLocation と同じ方針)。
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            const retry = await this.prisma.tag.findUnique({ where: { name } });
            if (retry) return retry;
          }
          throw err;
        }
      }),
    );
    return tags;
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

    return formatPost(post as PostWithRelations);
  }

  async findAll(limit: number = 10, offset: number = 0) {
    // コントローラから渡る値は生の parseInt なので、NaN や過大値をここで正規化する
    const take = clampInt(limit, 1, MAX_PAGE_SIZE, 10);
    const skip = clampInt(offset, 0, Number.MAX_SAFE_INTEGER, 0);

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { isPublic: true },
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.post.count({ where: { isPublic: true } }),
    ]);

    return {
      posts: (posts as PostWithRelations[]).map(formatPost),
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
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      posts: (posts as PostWithRelations[]).map(formatPost),
      total,
      hasMore: offset + limit < total,
    };
  }

  async findManyByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids }, isPublic: true },
      include: postInclude,
    });
    return (posts as PostWithRelations[]).map(formatPost);
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
      .filter((p): p is NonNullable<typeof p> => p !== null);

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
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // 非公開投稿は投稿者本人のみ閲覧できる。
    // 存在自体を隠すため403ではなく404を返す。
    if (!post.isPublic && post.authorId !== requesterId) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return {
      ...formatPost(post as PostWithRelations),
      favoritesCount,
    };
  }

  async update(id: number, updatePostDto: UpdatePostDto, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    const {
      tags,
      location: locationName,
      latitude,
      longitude,
      prefecture,
      ...postData
    } = updatePostDto;

    let locationId: number | undefined;
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
        locationId = undefined;
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
      ...formatPost(updatedPost as PostWithRelations),
      favoritesCount,
    };
  }

  async remove(id: number, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
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

    const hasGeo = centerLat !== undefined && centerLng !== undefined;
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
    }

    const rows = hasGeo
      ? await this.prisma.$queryRaw<RawPost[]>`
          SELECT
            p.id, p.title, p.content, p."imageUrl", p."isPublic",
            p."createdAt", p."updatedAt", p."authorId", p."locationId",
            u.id as "author_id", u.name as "author_name", u.avatar as "author_avatar",
            l.name as "location_name", l.prefecture, l.latitude, l.longitude,
            (6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(${centerLat})) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians(${centerLng})) +
                sin(radians(${centerLat})) * sin(radians(l.latitude))
              ))
            )) as distance,
            COUNT(*) OVER() AS total_count,
            COALESCE(
              (SELECT array_agg(t.name ORDER BY t.name)
               FROM post_tag pt
               JOIN tag t ON pt."tagId" = t.id
               WHERE pt."postId" = p.id),
              ARRAY[]::text[]
            ) as tags
          FROM post p
          JOIN "user" u ON p."authorId" = u.id
          LEFT JOIN location l ON p."locationId" = l.id
          WHERE p."isPublic" = true
            AND l.latitude IS NOT NULL
            AND l.longitude IS NOT NULL
            AND (6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(${centerLat})) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians(${centerLng})) +
                sin(radians(${centerLat})) * sin(radians(l.latitude))
              ))
            )) <= ${radius}
            AND (
              ${searchPattern}::text IS NULL OR (
                p.title ILIKE ${searchPattern} OR
                p.content ILIKE ${searchPattern} OR
                l.name ILIKE ${searchPattern} OR
                u.name ILIKE ${searchPattern}
              )
            )
          ORDER BY distance ASC, p."createdAt" DESC, p.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await this.prisma.$queryRaw<RawPost[]>`
          SELECT
            p.id, p.title, p.content, p."imageUrl", p."isPublic",
            p."createdAt", p."updatedAt", p."authorId", p."locationId",
            u.id as "author_id", u.name as "author_name", u.avatar as "author_avatar",
            l.name as "location_name", l.prefecture, l.latitude, l.longitude,
            NULL::float as distance,
            COUNT(*) OVER() AS total_count,
            COALESCE(
              (SELECT array_agg(t.name ORDER BY t.name)
               FROM post_tag pt
               JOIN tag t ON pt."tagId" = t.id
               WHERE pt."postId" = p.id),
              ARRAY[]::text[]
            ) as tags
          FROM post p
          JOIN "user" u ON p."authorId" = u.id
          LEFT JOIN location l ON p."locationId" = l.id
          WHERE p."isPublic" = true
            AND l.latitude IS NOT NULL
            AND l.longitude IS NOT NULL
            AND (
              ${searchPattern}::text IS NULL OR (
                p.title ILIKE ${searchPattern} OR
                p.content ILIKE ${searchPattern} OR
                l.name ILIKE ${searchPattern} OR
                u.name ILIKE ${searchPattern}
              )
            )
          ORDER BY p."createdAt" DESC, p.id ASC
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

    return {
      locations: locations
        .filter((loc) => loc._count.posts > 0)
        .map((loc) => ({
          id: loc.id,
          name: loc.name,
          prefecture: loc.prefecture,
          latitude: loc.latitude,
          longitude: loc.longitude,
          count: loc._count.posts,
        })),
      total: locations.length,
    };
  }
}
