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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const postInclude = {
  author: {
    select: { id: true, name: true, email: true, avatar: true },
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
    email: string;
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
    location: post.location?.name || null,
    latitude: post.location?.latitude || null,
    longitude: post.location?.longitude || null,
    prefecture: post.location?.prefecture || null,
  };
}

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateLocation(
    locationName: string,
    latitude?: number,
    longitude?: number,
    prefecture?: string,
  ) {
    const existing = await this.prisma.location.findFirst({
      where: {
        name: locationName,
        ...(latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : {}),
      },
    });

    if (existing) return existing;

    return this.prisma.location.create({
      data: {
        name: locationName,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        prefecture: prefecture ?? null,
      },
    });
  }

  private async getOrCreateTags(tagNames: string[]) {
    const tags = await Promise.all(
      tagNames.map(async (name) => {
        const existing = await this.prisma.tag.findUnique({ where: { name } });
        if (existing) return existing;

        return this.prisma.tag.create({
          data: {
            name,
            slug: slugify(name) || name.toLowerCase(),
          },
        });
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

    return formatPost(post as PostWithRelations);
  }

  async findAll(limit: number = 10, offset: number = 0) {
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { isPublic: true },
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where: { isPublic: true } }),
    ]);

    return {
      posts: (posts as PostWithRelations[]).map(formatPost),
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

  async findOne(id: number) {
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

    if (tags !== undefined) {
      await this.prisma.postTag.deleteMany({ where: { postId: id } });

      if (tags.length > 0) {
        const tagRecords = await this.getOrCreateTags(tags);
        await this.prisma.postTag.createMany({
          data: tagRecords.map((tag) => ({ postId: id, tagId: tag.id })),
        });
      }
    }

    const [updatedPost, favoritesCount] = await Promise.all([
      this.prisma.post.update({
        where: { id },
        data: {
          ...postData,
          ...(locationId !== undefined && { locationId }),
        },
        include: postInclude,
      }),
      this.prisma.bookmark.count({ where: { postId: id } }),
    ]);

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

  async findByAuthor(authorId: number, limit: number = 10, offset: number = 0) {
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId },
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.post.count({ where: { authorId } }),
    ]);

    return {
      posts: (posts as PostWithRelations[]).map(formatPost),
      total,
      hasMore: offset + limit < total,
    };
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

    if (centerLat && centerLng) {
      const distanceQuery = `
        (6371 * acos(
          cos(radians(${centerLat})) * cos(radians(l.latitude)) *
          cos(radians(l.longitude) - radians(${centerLng})) +
          sin(radians(${centerLat})) * sin(radians(l.latitude))
        ))
      `;

      const radiusFilter = `${distanceQuery} <= ${radius}`;

      const posts = await this.prisma.$queryRaw`
        SELECT
          p.id, p.title, p.content, p."imageUrl", p."isPublic",
          p."createdAt", p."updatedAt", p."authorId", p."locationId",
          u.id as "author_id", u.name as "author_name", u.email as "author_email", u.avatar as "author_avatar",
          l.name as "location_name", l.prefecture, l.latitude, l.longitude,
          ${Prisma.raw(distanceQuery)} as distance
        FROM post p
        JOIN "user" u ON p."authorId" = u.id
        LEFT JOIN location l ON p."locationId" = l.id
        WHERE p."isPublic" = true
          AND l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
          AND ${Prisma.raw(radiusFilter)}
        ${
          q
            ? Prisma.raw(`
          AND (
            p.title ILIKE '%${q}%' OR
            p.content ILIKE '%${q}%' OR
            l.name ILIKE '%${q}%' OR
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
        LEFT JOIN location l ON p."locationId" = l.id
        WHERE p."isPublic" = true
          AND l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
          AND ${Prisma.raw(radiusFilter)}
        ${
          q
            ? Prisma.raw(`
          AND (
            p.title ILIKE '%${q}%' OR
            p.content ILIKE '%${q}%' OR
            l.name ILIKE '%${q}%' OR
            u.name ILIKE '%${q}%'
          )
        `)
            : Prisma.empty
        }
      `;

      const postIds = (posts as { id: number }[]).map((p) => p.id);
      const postTags = await this.prisma.postTag.findMany({
        where: { postId: { in: postIds } },
        include: { tag: true },
      });

      const tagsByPostId = new Map<number, string[]>();
      postTags.forEach((pt) => {
        const existing = tagsByPostId.get(pt.postId) || [];
        existing.push(pt.tag.name);
        tagsByPostId.set(pt.postId, existing);
      });

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
        author_email: string;
        author_avatar: string | null;
        location_name: string | null;
        prefecture: string | null;
        latitude: number | null;
        longitude: number | null;
        distance?: number;
      }

      const formattedPosts = (posts as RawPost[]).map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        isPublic: post.isPublic,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        authorId: post.authorId,
        location: post.location_name,
        prefecture: post.prefecture,
        latitude: post.latitude,
        longitude: post.longitude,
        tags: tagsByPostId.get(post.id) || [],
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

    const posts = await this.prisma.$queryRaw`
      SELECT
        p.id, p.title, p.content, p."imageUrl", p."isPublic",
        p."createdAt", p."updatedAt", p."authorId", p."locationId",
        u.id as "author_id", u.name as "author_name", u.email as "author_email", u.avatar as "author_avatar",
        l.name as "location_name", l.prefecture, l.latitude, l.longitude
      FROM post p
      JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN location l ON p."locationId" = l.id
      WHERE p."isPublic" = true
        AND l.latitude IS NOT NULL
        AND l.longitude IS NOT NULL
      ${
        q
          ? Prisma.raw(`
        AND (
          p.title ILIKE '%${q}%' OR
          p.content ILIKE '%${q}%' OR
          l.name ILIKE '%${q}%' OR
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
      LEFT JOIN location l ON p."locationId" = l.id
      WHERE p."isPublic" = true
        AND l.latitude IS NOT NULL
        AND l.longitude IS NOT NULL
      ${
        q
          ? Prisma.raw(`
        AND (
          p.title ILIKE '%${q}%' OR
          p.content ILIKE '%${q}%' OR
          l.name ILIKE '%${q}%' OR
          u.name ILIKE '%${q}%'
        )
      `)
          : Prisma.empty
      }
    `;

    const postIds = (posts as { id: number }[]).map((p) => p.id);
    const postTags = await this.prisma.postTag.findMany({
      where: { postId: { in: postIds } },
      include: { tag: true },
    });

    const tagsByPostId = new Map<number, string[]>();
    postTags.forEach((pt) => {
      const existing = tagsByPostId.get(pt.postId) || [];
      existing.push(pt.tag.name);
      tagsByPostId.set(pt.postId, existing);
    });

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
      author_email: string;
      author_avatar: string | null;
      location_name: string | null;
      prefecture: string | null;
      latitude: number | null;
      longitude: number | null;
    }

    const formattedPosts = (posts as RawPost[]).map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      isPublic: post.isPublic,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      authorId: post.authorId,
      location: post.location_name,
      prefecture: post.prefecture,
      latitude: post.latitude,
      longitude: post.longitude,
      tags: tagsByPostId.get(post.id) || [],
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
