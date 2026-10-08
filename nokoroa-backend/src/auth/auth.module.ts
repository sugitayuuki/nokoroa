import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_TOKEN_EXPIRES_IN_SECONDS } from './auth-cookie';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getJwtSecret } from './jwt-secret';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

/**
 * JwtModule の設定。
 *
 * トークンの寿命は認証クッキーの寿命と同じでなければならない（ずれると
 * 「クッキーは残っているが JWT は失効」で全 API が 401 になる）。
 * 二重管理をやめ、auth-cookie.ts の定数から導出している。
 * この対応は auth-cookie.spec.ts が検証する。
 */
export function jwtModuleOptions(): JwtModuleOptions {
  return {
    secret: getJwtSecret(),
    signOptions: { expiresIn: AUTH_TOKEN_EXPIRES_IN_SECONDS },
  };
}

@Module({
  imports: [
    PassportModule,
    // register() だとモジュール読み込み時に評価され、.env を読む前に
    // 鍵の検証が走ってしまう。アプリ初期化時に解決させる。
    JwtModule.registerAsync({ useFactory: jwtModuleOptions }),
  ],
  // PrismaService は @Global() な PrismaModule が提供する。
  // ここで再宣言すると別インスタンスになり、接続プールが余分に張られる。
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
