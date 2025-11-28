import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchPostsByLocationDto } from './dto/search-posts-by-location.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto & { authorId: number }) {
    return this.prisma.post.create({
      data: {
        ...createPostDto,
        tags: createPostDto.tags || [],
        isPublic: createPostDto.isPublic ?? true,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async findAll(limit: number = 10, offset: number = 0) {
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { isPublic: true },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where: { isPublic: true } }),
    ]);

    return {
      posts,
      total,
      hasMore: offset + limit < total,
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
          tags: { hasSome: tags },
        }),
      ...(location && {
        location: { contains: location, mode: 'insensitive' },
      }),
      ...(authorId && {
        authorId: authorId,
      }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      posts,
      total,
      hasMore: offset + limit < total,
    };
  }

  async findOne(id: number) {
    const [post, favoritesCount] = await Promise.all([
      this.prisma.post.findUnique({
        where: { id },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      this.prisma.bookmark.count({ where: { postId: id } }),
    ]);

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    return {
      ...post,
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

    const [updatedPost, favoritesCount] = await Promise.all([
      this.prisma.post.update({
        where: { id },
        data: updatePostDto,
        include: {
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      this.prisma.bookmark.count({ where: { postId: id } }),
    ]);

    return {
      ...updatedPost,
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

  async findByAuthor(authorId: number, limit: number = 10, offset: number = 0) {
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where: { authorId } }),
    ]);

    return {
      posts,
      total,
      hasMore: offset + limit < total,
    };
  }

  async searchByLocation(searchDto: SearchPostsByLocationDto) {
    const {
      centerLat,
      centerLng,
      radius = 10, // デフォルト10km
      limit = 10,
      offset = 0,
      q,
    } = searchDto;

    if (centerLat && centerLng) {
      // Haversine formulaを使用した距離計算
      const distanceQuery = `
        (6371 * acos(
          cos(radians(${centerLat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${centerLng})) +
          sin(radians(${centerLat})) * sin(radians(latitude))
        ))
      `;

      // 指定された半径内の投稿をフィルタリング
      const radiusFilter = `${distanceQuery} <= ${radius}`;

      // Raw SQLを使用して距離でフィルタリング
      const posts = await this.prisma.$queryRaw`
        SELECT p.*, u.id as "author_id", u.name as "author_name", u.email as "author_email", u.avatar as "author_avatar",
               ${Prisma.raw(distanceQuery)} as distance
        FROM post p
        JOIN "user" u ON p."authorId" = u.id
        WHERE p."isPublic" = true 
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND ${Prisma.raw(radiusFilter)}
        ${
          q
            ? Prisma.raw(`
          AND (
            p.title ILIKE '%${q}%' OR 
            p.content ILIKE '%${q}%' OR 
            p.location ILIKE '%${q}%' OR 
            u.name ILIKE '%${q}%'
          )
        `)
            : Prisma.empty
        }
        ORDER BY distance ASC, p."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const total = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM post p
        JOIN "user" u ON p."authorId" = u.id
        WHERE p."isPublic" = true 
          AND p.latitude IS NOT NULL 
          AND p.longitude IS NOT NULL
          AND ${Prisma.raw(radiusFilter)}
        ${
          q
            ? Prisma.raw(`
          AND (
            p.title ILIKE '%${q}%' OR 
            p.content ILIKE '%${q}%' OR 
            p.location ILIKE '%${q}%' OR 
            u.name ILIKE '%${q}%'
          )
        `)
            : Prisma.empty
        }
      `;

      interface PostWithAuthor {
        id: number;
        title: string;
        content: string;
        imageUrl: string | null;
        location: string | null;
        latitude: number | null;
        longitude: number | null;
        tags: string[];
        isPublic: boolean;
        createdAt: Date;
        updatedAt: Date;
        authorId: number;
        author_id: number;
        author_name: string;
        author_email: string;
        author_avatar: string | null;
        distance?: number;
      }

      const formattedPosts = (posts as PostWithAuthor[]).map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        location: post.location,
        latitude: post.latitude,
        longitude: post.longitude,
        tags: post.tags,
        isPublic: post.isPublic,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        authorId: post.authorId,
        author: {
          id: post.author_id,
          name: post.author_name,
          email: post.author_email,
          avatar: post.author_avatar,
        },
        distance: post.distance,
      }));

      return {
        posts: formattedPosts,
        total: Number(total[0].count),
        hasMore: offset + limit < Number(total[0].count),
      };
    }

    // 中心点が指定されていない場合は、緯度・経度を持つすべての投稿を返す
    const posts = await this.prisma.$queryRaw`
      SELECT p.*, u.id as "author_id", u.name as "author_name", u.email as "author_email", u.avatar as "author_avatar"
      FROM post p
      JOIN "user" u ON p."authorId" = u.id
      WHERE p."isPublic" = true 
        AND p.latitude IS NOT NULL 
        AND p.longitude IS NOT NULL
      ${
        q
          ? Prisma.raw(`
        AND (
          p.title ILIKE '%${q}%' OR 
          p.content ILIKE '%${q}%' OR 
          p.location ILIKE '%${q}%' OR 
          u.name ILIKE '%${q}%'
        )
      `)
          : Prisma.empty
      }
      ORDER BY p."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const total = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM post p
      JOIN "user" u ON p."authorId" = u.id
      WHERE p."isPublic" = true 
        AND p.latitude IS NOT NULL 
        AND p.longitude IS NOT NULL
      ${
        q
          ? Prisma.raw(`
        AND (
          p.title ILIKE '%${q}%' OR 
          p.content ILIKE '%${q}%' OR 
          p.location ILIKE '%${q}%' OR 
          u.name ILIKE '%${q}%'
        )
      `)
          : Prisma.empty
      }
    `;

    interface PostWithAuthor {
      id: number;
      title: string;
      content: string;
      imageUrl: string | null;
      location: string | null;
      latitude: number | null;
      longitude: number | null;
      tags: string[];
      isPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
      authorId: number;
      author_id: number;
      author_name: string;
      author_email: string;
      author_avatar: string | null;
      distance?: number;
    }

    const formattedPosts = (posts as PostWithAuthor[]).map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      location: post.location,
      latitude: post.latitude,
      longitude: post.longitude,
      tags: post.tags,
      isPublic: post.isPublic,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      authorId: post.authorId,
      author: {
        id: post.author_id,
        name: post.author_name,
        email: post.author_email,
        avatar: post.author_avatar,
      },
    }));

    return {
      posts: formattedPosts,
      total: Number(total[0].count),
      hasMore: offset + limit < Number(total[0].count),
    };
  }

  async getTags() {
    // 公開投稿からすべてのタグを取得し、使用回数とともに返す
    const posts = await this.prisma.post.findMany({
      where: { isPublic: true },
      select: { tags: true },
    });

    // すべてのタグを平坦化して集計
    const tagCount: Record<string, number> = {};
    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // タグを使用回数の多い順にソートして返す
    const sortedTags = Object.entries(tagCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      tags: sortedTags,
      total: sortedTags.length,
    };
  }
}
