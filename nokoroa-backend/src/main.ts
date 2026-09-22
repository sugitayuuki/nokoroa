import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // ALB 配下では req.ip が ALB ノードのIPになるため、これが無いと
  // レート制限が「IPごと」ではなく「全ユーザー共有」になり、
  // 1人の攻撃者が全員を 429 にできてしまう。ALBは1ホップ。
  app.set('trust proxy', 1);

  // セキュリティヘッダ。他のミドルウェアより先に適用する。
  // 画像は別オリジン(フロント)から参照されるため CORP は緩める。
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Nokoroa API')
    .setDescription('旅行の思い出を共有するSNSアプリ Nokoroa のAPI仕様書')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWTトークンを入力してください',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', '認証関連')
    .addTag('users', 'ユーザー関連')
    .addTag('posts', '投稿関連')
    .addTag('favorites', 'ブックマーク関連')
    .addTag('follows', 'フォロー関連')
    .build();
  // API仕様書は全エンドポイントとDTOを列挙するため本番では公開しない。
  if (!isProduction) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapter));

  // 静的ファイルの提供設定
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // CORSの設定
  // 本番でFRONTEND_URLが未設定だとlocalhostへフォールバックしCORSが実質無効に
  // なるため、設定漏れは起動時に失敗させる。
  const frontendUrl = process.env.FRONTEND_URL;
  if (isProduction && !frontendUrl) {
    throw new Error('FRONTEND_URL is not set.');
  }
  app.enableCors({
    origin: frontendUrl || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ECSのタスク停止(SIGTERM)時に PrismaService.onModuleDestroy を発火させ、
  // DB接続をクリーンに閉じる
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}
void bootstrap();
