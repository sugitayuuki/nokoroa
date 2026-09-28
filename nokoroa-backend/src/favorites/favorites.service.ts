import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  formatPostWithFavoritesCount,
  postWithFavoritesCountInclude,
} from '../posts/post-format';
import { PrismaService } from '../prisma/prisma.service';

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
          include: postWithFavoritesCountInclude,
        },
      },
    });

    return {
      id: bookmark.id,
      createdAt: bookmark.createdAt,
      post: formatPostWithFavoritesCount(bookmark.post),
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
    // ここで可視性を再評価しないと非公開投稿の本文が返り続ける。
    // 自分の投稿は非公開でも見られる(findOne と同じ基準)。
    const where = {
      userId,
      post: { OR: [{ isPublic: true }, { authorId: userId }] },
    };

    const [favorites, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where,
        include: {
          post: {
            include: postWithFavoritesCountInclude,
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
        post: formatPostWithFavoritesCount(fav.post),
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
