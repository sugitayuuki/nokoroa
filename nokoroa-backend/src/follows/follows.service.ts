import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new ConflictException('自分自身をフォローすることはできません');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('すでにフォローしています');
    }

    return await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  async unfollow(followerId: number, followingId: number) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('フォロー関係が見つかりません');
    }

    await this.prisma.follow.delete({
      where: {
        id: follow.id,
      },
    });

    return { message: 'フォローを解除しました' };
  }

  async getFollowers(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followingId: userId,
        },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              avatar: true,
              bio: true,
              _count: {
                select: {
                  followers: true,
                  following: true,
                  posts: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
    ]);

    return {
      followers: followers.map((f) => ({
        ...f.follower,
        followedAt: f.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowing(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followerId: userId,
        },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              avatar: true,
              bio: true,
              _count: {
                select: {
                  followers: true,
                  following: true,
                  posts: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ]);

    return {
      following: following.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkFollowStatus(followerId: number, followingId: number) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return {
      isFollowing: !!follow,
      followedAt: follow?.createdAt || null,
    };
  }

  async getFollowStats(userId: number) {
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ]);

    return {
      followersCount,
      followingCount,
    };
  }
}
