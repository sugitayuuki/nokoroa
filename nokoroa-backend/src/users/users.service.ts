import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash, compare } from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserResponse } from './interfaces/create-user-response.interface';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<CreateUserResponse> {
    const hashedPassword = await hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
      },
    });

    const { password: _password, ...userWithoutPassword } = user;
    return {
      message: 'ユーザーが正常に作成されました',
      user: userWithoutPassword,
    };
  }

  async findById(id: number, currentUserId?: number) {
    const isOwner = currentUserId === id;

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        posts: {
          // 非公開投稿は本人にのみ返す
          ...(isOwner ? {} : { where: { isPublic: true } }),
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    let isFollowing = false;
    if (currentUserId && currentUserId !== id) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: id,
          },
        },
      });
      isFollowing = !!follow;
    }

    // 除外リスト方式(passwordだけ外してspread)だと、schemaに列が増えるたびに
    // 自動で公開されてしまう。返すフィールドを明示する許可リスト方式にする。
    return {
      id: user.id,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      posts: user.posts,
      _count: user._count,
      // メールアドレスは本人にのみ返す
      ...(isOwner ? { email: user.email } : {}),
      isFollowing,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // ユーザーが存在するかチェック
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    // DTO をそのまま data に渡さない。書き込むフィールドを明示することで、
    // DTO に列が増えても意図しない更新経路が生まれないようにする。
    const data: Prisma.UserUpdateInput = {};
    if (updateUserDto.name !== undefined) data.name = updateUserDto.name;
    if (updateUserDto.bio !== undefined) data.bio = updateUserDto.bio;

    // ユーザー情報を更新
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    const { password: _password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async changePassword(id: number, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    // 新しいパスワードと確認パスワードが一致するかチェック
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        '新しいパスワードと確認パスワードが一致しません',
      );
    }

    // ユーザーを取得（パスワード含む）
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    // Google 連携のみのユーザーは password が null。
    // compare(x, null) は bcrypt が throw するため 500 になる。
    if (!user.password) {
      throw new BadRequestException(
        'このアカウントはパスワード認証を使用していません',
      );
    }

    // 現在のパスワードが正しいかチェック
    const isCurrentPasswordValid = await compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('現在のパスワードが正しくありません');
    }

    // 現在のパスワードと新しいパスワードが同じでないかチェック
    const isSamePassword = await compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        '新しいパスワードは現在のパスワードと異なる必要があります',
      );
    }

    // 新しいパスワードをハッシュ化
    const hashedNewPassword = await hash(newPassword, 10);

    // パスワードを更新
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });

    return { message: 'パスワードが正常に変更されました' };
  }

  async updateAvatar(id: number, avatarUrl: string) {
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}
