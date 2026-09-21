import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // セキュリティヘッダ。他のミドルウェアより先に適用する。
  app.use(helmet());
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

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
