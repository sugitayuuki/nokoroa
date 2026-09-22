import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CommonModule } from './common/common.module';
import { isTestEnv } from './common/environment';
import { USER_THROTTLER, trackedUserId } from './common/user-throttler.guard';
import { FavoritesModule } from './favorites/favorites.module';
import { FollowsModule } from './follows/follows.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

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
  // グローバルは IP 単位の基礎制限（default）のみを評価する。
  // user throttler は skipIf により、認証後の UserThrottlerGuard でのみ効く。
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
