import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { publicAuthorSelect } from '../common/public-author.select';
import { PrismaService } from '../prisma/prisma.service';

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
  _count: {
    select: { bookmarks: true },
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
  } | null;
  postTags: {
    tag: {
      id: number;
      name: string;
      slug: string;
    };
  }[];
  _count: {
    bookmarks: number;
  };
}

function formatPost(post: PostWithRelations) {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    isPublic: post.isPublic,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    authorId: post.authorId,
    author: post.author,
    tags: post.postTags.map((pt) => pt.tag.name),
    location: post.location?.name || null,
    latitude: post.location?.latitude || null,
    longitude: post.location?.longitude || null,
    prefecture: post.location?.prefecture || null,
    favoritesCount: post._count.bookmarks,
  };
}

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async addFavorite(userId: number, postId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, isPublic: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const existingFavorite = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingFavorite) {
      throw new ConflictException('Post is already in favorites');
    }

    const bookmark = await this.prisma.bookmark.create({
      data: {
        userId,
        postId,
      },
      include: {
        post: {
          include: postInclude,
        },
      },
    });

    return {
      id: bookmark.id,
      createdAt: bookmark.createdAt,
      post: formatPost(bookmark.post as PostWithRelations),
    };
  }

  async removeFavorite(userId: number, postId: number) {
    const favorite = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.bookmark.delete({
      where: { id: favorite.id },
    });

    return { message: 'Favorite removed successfully' };
  }

  async getUserFavorites(
    userId: number,
    limit: number = 10,
    offset: number = 0,
  ) {
    // ブックマーク後に投稿が非公開化された場合、ブックマークは残るため
    // ここで可視性を再評価しないと非公開投稿の本文が返り続ける
    const where = { userId, post: { isPublic: true } };

    const [favorites, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where,
        include: {
          post: {
            include: postInclude,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.bookmark.count({ where }),
    ]);

    return {
      favorites: favorites.map((fav) => ({
        id: fav.id,
        createdAt: fav.createdAt,
        post: formatPost(fav.post as PostWithRelations),
      })),
      total,
      hasMore: offset + limit < total,
    };
  }

  async checkFavoriteStatus(userId: number, postId: number) {
    const favorite = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    return { isFavorited: !!favorite };
  }

  async getFavoriteStats(postId: number) {
    // 無認証で呼べるエンドポイントなので、非公開投稿の人気度を
    // 観測できないよう公開投稿に限定する
    const count = await this.prisma.bookmark.count({
      where: { postId, post: { isPublic: true } },
    });

    return { favoritesCount: count };
  }
}
