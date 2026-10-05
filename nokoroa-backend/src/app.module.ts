import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CommonModule } from './common/common.module';
import { isTestEnv } from './common/environment';
import { FetchMetadataGuard } from './common/fetch-metadata.guard';
import { USER_THROTTLER, trackedUserId } from './common/user-throttler.guard';
import { createValidationPipe } from './common/validation';
import { FavoritesModule } from './favorites/favorites.module';
import { FollowsModule } from './follows/follows.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

/** Nest のミドルウェア受け口に合わせた関数ミドルウェアの型 */
type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // レート制限は2本立て。
    //  default: IP単位の基礎制限。グローバルガードが全経路で評価する。
    //  user   : ユーザー単位の制限。グローバルガードは認証ガードより先に走り
    //           req.user を読めないため、そこでは必ずスキップされ、
    //           認証後に適用される UserThrottlerGuard だけが評価する。
    // e2e は同一プロセスから多数のリクエストを撃つため、テスト時は無効化する。
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 100 },
        {
          name: USER_THROTTLER,
          ttl: 60_000,
          // 実際の上限は各コントローラの @Throttle で指定する
          limit: 1000,
          // 名前付き skipIf は共通 skipIf を上書きするため、テスト判定も含める
          skipIf: (ctx) => isTestEnv() || trackedUserId(ctx) === undefined,
        },
      ],
      skipIf: () => isTestEnv(),
    }),
    CommonModule,
    UsersModule,
    PrismaModule,
    AuthModule,
    PostsModule,
    FavoritesModule,
    FollowsModule,
    ChatModule,
  ],
  controllers: [AppController],
  // 認証クッキー・バリデーション・クロスサイト拒否は、本番と E2E で必ず同じで
  // なければならない。main.ts 側に書くと、E2E はアプリを自前で組み直すため乖離し、
  // 本番側の配線を消してもテストが全緑のままになる。
  // モジュールグラフに置けば、AppModule を読み込む全経路が自動的に同じ設定になる。
  providers: [
    AppService,
    // 素の ValidationPipe だと transform が効かないため共通設定を使う
    { provide: APP_PIPE, useFactory: createValidationPipe },
    // クロスサイト拒否は認証より先に評価されるよう、先に登録する
    { provide: APP_GUARD, useClass: FetchMetadataGuard },
    // グローバルは IP 単位の基礎制限（default）のみを評価する。
    // user throttler は skipIf により、認証後の UserThrottlerGuard でのみ効く。
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // JWT は httpOnly クッキーで渡すため、req.cookies を使えるようにする。
    // これが無いと JwtStrategy のクッキー取り出しが常に空振りし、
    // Authorization ヘッダのある Swagger だけ通る状態になる。
    //
    // cookieParser() は express の RequestHandler を返すが、Nest の
    // MiddlewareConsumer.apply の型は関数とクラスの合併を狭く取っているため、
    // ここだけ Nest 側の受け口に合わせて渡す。
    consumer
      .apply(cookieParser() as unknown as MiddlewareFunction, LoggerMiddleware)
      .forRoutes('*');
  }
}
