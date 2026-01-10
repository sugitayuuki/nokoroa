import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { createUserAndLogin } from './helpers';
import { cleanupDatabase } from './setup';
import {
  FavoriteCheckResponse,
  FavoriteResponse,
  FavoritesListResponse,
  PostResponse,
} from './types';
import { AppModule } from '../src/app.module';

describe('Favorites (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;
  let postId: number;

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
    const user = await createUserAndLogin(
      app,
      'favorites@example.com',
      'password123',
      'Favorites User',
    );
    accessToken = user.accessToken;

    const postResponse = await request(server)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'ブックマーク用投稿',
        content: 'ブックマークテスト用の投稿です',
      });
    postId = (postResponse.body as PostResponse).id;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  describe('POST /favorites/:postId', () => {
    it('投稿をブックマークに追加できる', async () => {
      const response = await request(server)
        .post(`/favorites/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const body = response.body as FavoriteResponse;
      expect(body.success).toBe(true);
    });

    it('認証なしではブックマークできない', async () => {
      await request(server).post(`/favorites/${postId}`).expect(401);
    });

    it('存在しない投稿はブックマークできない', async () => {
      await request(server)
        .post('/favorites/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /favorites/:postId', () => {
    it('ブックマークを解除できる', async () => {
      await request(server)
        .post(`/favorites/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(server)
        .delete(`/favorites/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FavoriteResponse;
      expect(body.success).toBe(true);
    });

    it('認証なしでは解除できない', async () => {
      await request(server).delete(`/favorites/${postId}`).expect(401);
    });
  });

  describe('GET /favorites', () => {
    it('ブックマーク一覧を取得できる', async () => {
      await request(server)
        .post(`/favorites/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(server)
        .get('/favorites')
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FavoritesListResponse;
      expect(body.favorites).toBeDefined();
      expect(body.favorites.length).toBe(1);
    });

    it('認証なしでは取得できない', async () => {
      await request(server)
        .get('/favorites')
        .query({ limit: 10, offset: 0 })
        .expect(401);
    });
  });

  describe('GET /favorites/check/:postId', () => {
    it('ブックマーク済みの場合trueを返す', async () => {
      await request(server)
        .post(`/favorites/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await request(server)
        .get(`/favorites/check/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FavoriteCheckResponse;
      expect(body.isFavorited).toBe(true);
    });

    it('ブックマークしていない場合falseを返す', async () => {
      const response = await request(server)
        .get(`/favorites/check/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FavoriteCheckResponse;
      expect(body.isFavorited).toBe(false);
    });
  });
});
