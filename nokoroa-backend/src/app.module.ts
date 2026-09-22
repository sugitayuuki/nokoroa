import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CommonModule } from './common/common.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FollowsModule } from './follows/follows.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 既定のレート制限。認証系やAI課金が絡む経路は @Throttle で個別に絞る。
    // e2e は同一プロセスから多数のリクエストを撃つため、テスト時は無効化する
    // (skipIf は @Throttle による個別指定にも効く)。
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.NODE_ENV === 'test',
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
  // グローバルガードはIP単位の基礎的な制限。
  // ユーザー単位の制限はコントローラ側で JwtAuthGuard の後に適用する
  // (グローバルガードは認証ガードより先に走るため req.user を読めない)。
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
