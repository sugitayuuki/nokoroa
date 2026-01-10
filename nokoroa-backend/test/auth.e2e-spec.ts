import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { cleanupDatabase } from './setup';
import { LoginResponse, SignupResponse, UserProfile } from './types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;

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
