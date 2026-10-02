import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { cleanupDatabase } from './setup';
import { LoginResponse, SignupResponse, UserProfile } from './types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/auth/auth-cookie';
import { createValidationPipe } from '../src/common/validation';

/**
 * Set-Cookie から目的のクッキー 1 件の生文字列を取り出す。
 * 属性まで含めて検証したいので、パースせず raw のまま返す。
 */
function findSetCookie(
  response: request.Response,
  name: string,
): string | undefined {
  const header: unknown = response.headers['set-cookie'];
  const cookies: string[] = Array.isArray(header)
    ? (header as string[])
    : typeof header === 'string'
      ? [header]
      : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

/** Set-Cookie 文字列から「name=value」部分だけを取り出し、Cookie ヘッダ用に整える。 */
function toCookieHeader(setCookie: string): string {
  return setCookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // 本番(main.ts)と同一オプションのパイプを使う(素の ValidationPipe だと transform が効かない)
    app.useGlobalPipes(createValidationPipe());
    // 本番(main.ts)と同じく cookie-parser を有効にする。
    // 無いと req.cookies が空のままで、クッキー認証が通らない
    app.use(cookieParser());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  describe('POST /users/signup', () => {
    it('新規ユーザーを登録できる', async () => {
      const response = await request(server)
        .post('/users/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      const body = response.body as SignupResponse;
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.message).toBeDefined();
    });

    it('パスワードが短いとバリデーションエラー', async () => {
      await request(server)
        .post('/users/signup')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);
    });

    it('メールアドレスが不正だとバリデーションエラー', async () => {
      await request(server)
        .post('/users/signup')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(server).post('/users/signup').send({
        email: 'login@example.com',
        password: 'password123',
        name: 'Login User',
      });
    });

    it('正しい認証情報でログインできる', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(201);

      const body = response.body as LoginResponse;
      expect(body.access_token).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('login@example.com');
    });

    it('間違ったパスワードでログインできない', async () => {
      await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('存在しないユーザーでログインできない', async () => {
      await request(server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('JWT を httpOnly クッキーで発行する', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(201);

      const setCookie = findSetCookie(response, AUTH_COOKIE_NAME);
      expect(setCookie).toBeDefined();
      // JS から読めないこと・クロスサイトの更新リクエストに乗らないこと・
      // 全パスに送られること・寿命が JWT(1d)と揃っていることを属性で担保する
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\//i);
      expect(setCookie).toMatch(/Max-Age=86400\b/i);
    });

    it('ログイン失敗時はクッキーを発行しない', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeUndefined();
    });
  });

  describe('GET /auth/me', () => {
    let authCookie: string;
    let accessToken: string;

    beforeEach(async () => {
      await request(server).post('/users/signup').send({
        email: 'me@example.com',
        password: 'password123',
        name: 'Me User',
      });

      const loginResponse = await request(server).post('/auth/login').send({
        email: 'me@example.com',
        password: 'password123',
      });

      const setCookie = findSetCookie(loginResponse, AUTH_COOKIE_NAME);
      if (!setCookie) {
        throw new Error('ログインで認証クッキーが発行されていません');
      }
      authCookie = toCookieHeader(setCookie);
      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('クッキーだけでログイン中のユーザーを取得できる', async () => {
      const response = await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .expect(200);

      const body = response.body as UserProfile;
      expect(body.email).toBe('me@example.com');
      expect(body.name).toBe('Me User');
    });

    it('Authorization ヘッダでも取得できる(Swagger / 既存 E2E 用の経路)', async () => {
      const response = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((response.body as UserProfile).email).toBe('me@example.com');
    });

    it('認証なしでは取得できない', async () => {
      await request(server).get('/auth/me').expect(401);
    });

    it('不正なクッキーでは取得できない', async () => {
      await request(server)
        .get('/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=invalid-token`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('認証クッキーを失効させる', async () => {
      await request(server).post('/users/signup').send({
        email: 'logout@example.com',
        password: 'password123',
        name: 'Logout User',
      });
      const loginResponse = await request(server).post('/auth/login').send({
        email: 'logout@example.com',
        password: 'password123',
      });
      const setCookie = findSetCookie(loginResponse, AUTH_COOKIE_NAME);
      if (!setCookie) {
        throw new Error('ログインで認証クッキーが発行されていません');
      }

      const response = await request(server)
        .post('/auth/logout')
        .set('Cookie', toCookieHeader(setCookie))
        .expect(200);

      const clearedCookie = findSetCookie(response, AUTH_COOKIE_NAME);
      expect(clearedCookie).toBeDefined();
      // 値が空かつ過去の expires。属性は発行時と揃っていないと
      // ブラウザが別のクッキーとみなして上書きしない
      expect(clearedCookie).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=;`));
      expect(clearedCookie).toMatch(/Expires=/i);
      expect(clearedCookie).toMatch(/HttpOnly/i);
      expect(clearedCookie).toMatch(/SameSite=Lax/i);
      expect(clearedCookie).toMatch(/Path=\//i);
    });

    it('未ログインでも成功する(クッキーを消すだけなので冪等)', async () => {
      const response = await request(server).post('/auth/logout').expect(200);

      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeDefined();
    });
  });

  describe('GET /users/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      await request(server).post('/users/signup').send({
        email: 'profile@example.com',
        password: 'password123',
        name: 'Profile User',
      });

      const loginResponse = await request(server).post('/auth/login').send({
        email: 'profile@example.com',
        password: 'password123',
      });
      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('認証済みユーザーは自分のプロフィールを取得できる', async () => {
      const response = await request(server)
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UserProfile;
      expect(body.email).toBe('profile@example.com');
      expect(body.name).toBe('Profile User');
    });

    it('認証クッキーだけでもプロフィールを取得できる', async () => {
      // /auth/me 以外の既存の保護エンドポイントもクッキーで通ることを確かめる
      // (JWT の取り出しが Bearer 前提のまま残っていないかの担保)
      const loginResponse = await request(server).post('/auth/login').send({
        email: 'profile@example.com',
        password: 'password123',
      });
      const setCookie = findSetCookie(loginResponse, AUTH_COOKIE_NAME);
      if (!setCookie) {
        throw new Error('ログインで認証クッキーが発行されていません');
      }

      const response = await request(server)
        .get('/users/profile')
        .set('Cookie', toCookieHeader(setCookie))
        .expect(200);

      expect((response.body as UserProfile).email).toBe('profile@example.com');
    });

    it('認証なしではプロフィールを取得できない', async () => {
      await request(server).get('/users/profile').expect(401);
    });

    it('不正なトークンではプロフィールを取得できない', async () => {
      await request(server)
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
