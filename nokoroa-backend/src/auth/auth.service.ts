import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { GoogleUser } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      user &&
      user.password &&
      (await bcrypt.compare(password, user.password))
    ) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  /**
   * ログインセッションの本人情報だけを返す。
   *
   * 「このブラウザは誰としてログインしているか」を答えるのが役目で、bio や
   * 投稿一覧まで返す GET /users/profile とは意図的に別口にしている
   * (プロフィール全体の正は UsersService 側)。
   * トークンは httpOnly クッキーでフロントから読めないため、フロントは
   * この呼び出しが成功するかどうかでログイン状態を判断する。
   */
  async getSessionUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true },
    });

    // JWT は有効なのにユーザーが消えている(退会・DB 入れ替えなど)状態。
    // 認証済みとして返すとフロントが本人不明のままログイン状態になるため弾く。
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Google 認証のユーザーでログインする。
   *
   * googleId が未知の場合は email で既存アカウントを探して紐付ける。
   * この紐付けが安全なのは GoogleUser.email が「Google 側で確認済み」である
   * という前提に依っており、その検証は GoogleStrategy.validate が担う。
   */
  async googleLogin(googleUser: GoogleUser) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            avatar: user.avatar || googleUser.picture,
            provider: 'google',
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name,
            googleId: googleUser.googleId,
            avatar: googleUser.picture,
            provider: 'google',
          },
        });
      }
    }

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }
}
