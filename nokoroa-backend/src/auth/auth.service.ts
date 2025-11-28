import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

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

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async googleLogin(googleUser: any) {
    // Google認証ユーザーを検索または作成
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (!user) {
      // メールアドレスで既存ユーザーをチェック
      user = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        // 既存ユーザーにGoogleIDを紐付け
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            avatar: user.avatar || googleUser.picture,
            provider: 'google',
          },
        });
      } else {
        // 新規ユーザー作成
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
