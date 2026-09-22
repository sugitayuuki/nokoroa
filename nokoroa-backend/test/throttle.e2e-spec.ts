import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { createUserAndLogin } from './helpers';
import { cleanupDatabase } from './setup';
import { AppModule } from '../src/app.module';

/**
 * レート制限の適用単位を検証する。
 *
 * 通常のテストでは NODE_ENV=test により全てのレート制限を無効化しているため、
 * このスイートの中だけ一時的に有効化する（skipIf はリクエストごとに評価される）。
 */
describe('Throttling (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await cleanupDatabase();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await cleanupDatabase();
    await app.close();
  });

  const callChat = (token: string) =>
    request(server)
      .post('/chat/suggestions')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'x', ai_response: 'y' });

  it('チャットの上限はユーザー単位で、同一IPの別ユーザーを巻き込まない', async () => {
    process.env.NODE_ENV = 'test';
    const userA = await createUserAndLogin(app, 'throttle-a@example.com');
    const userB = await createUserAndLogin(app, 'throttle-b@example.com');
    process.env.NODE_ENV = 'development';

    // A が上限(20/分)に達するまで叩く
    let aFirst429 = -1;
    for (let i = 1; i <= 25; i += 1) {
      const res = await callChat(userA.accessToken);
      if (res.status === 429) {
        aFirst429 = i;
        break;
      }
    }

    expect(aFirst429).toBe(21);

    // 同一IPだが別ユーザーの B は影響を受けない
    const bRes = await callChat(userB.accessToken);
    expect(bRes.status).not.toBe(429);
  }, 60000);
});
