import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { createUserAndLogin } from './helpers';
import { cleanupDatabase } from './setup';
import { PostResponse, PostsListResponse } from './types';
import { AppModule } from '../src/app.module';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;

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
      'posts@example.com',
      'password123',
      'Posts User',
    );
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  describe('POST /posts', () => {
    it('認証済みユーザーは投稿を作成できる', async () => {
      const response = await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'テスト投稿',
          content: 'これはテスト投稿です',
          location: '東京',
          tags: ['旅行', 'グルメ'],
        })
        .expect(201);

      const body = response.body as PostResponse;
      expect(body.id).toBeDefined();
      expect(body.title).toBe('テスト投稿');
      expect(body.content).toBe('これはテスト投稿です');
    });

    it('認証なしでは投稿を作成できない', async () => {
      await request(server)
        .post('/posts')
        .send({
          title: 'テスト投稿',
          content: 'これはテスト投稿です',
        })
        .expect(401);
    });

    it('タイトルなしでは投稿を作成できない', async () => {
      await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'これはテスト投稿です',
        })
        .expect(400);
    });
  });

  describe('GET /posts', () => {
    beforeEach(async () => {
      await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '投稿1', content: '内容1' });
      await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '投稿2', content: '内容2' });
    });

    it('投稿一覧を取得できる', async () => {
      const response = await request(server).get('/posts').expect(200);

      const body = response.body as PostsListResponse;
      expect(body.posts).toBeDefined();
      expect(body.posts.length).toBe(2);
      expect(body.total).toBe(2);
    });

    it('ページネーションが動作する', async () => {
      const response = await request(server)
        .get('/posts?limit=1&offset=0')
        .expect(200);

      const body = response.body as PostsListResponse;
      expect(body.posts.length).toBe(1);
      expect(body.hasMore).toBe(true);
    });
  });

  describe('GET /posts/:id', () => {
    let postId: number;

    beforeEach(async () => {
      const response = await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '詳細テスト', content: '詳細内容' });
      postId = (response.body as PostResponse).id;
    });

    it('投稿詳細を取得できる', async () => {
      const response = await request(server)
        .get(`/posts/${postId}`)
        .expect(200);

      const body = response.body as PostResponse;
      expect(body.id).toBe(postId);
      expect(body.title).toBe('詳細テスト');
      expect(body.content).toBe('詳細内容');
    });

    it('存在しない投稿は404を返す', async () => {
      await request(server).get('/posts/99999').expect(404);
    });
  });

  describe('PUT /posts/:id', () => {
    let postId: number;

    beforeEach(async () => {
      const response = await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '更新前', content: '更新前内容' });
      postId = (response.body as PostResponse).id;
    });

    it('自分の投稿を更新できる', async () => {
      const response = await request(server)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '更新後', content: '更新後内容' })
        .expect(200);

      const body = response.body as PostResponse;
      expect(body.title).toBe('更新後');
      expect(body.content).toBe('更新後内容');
    });

    it('認証なしでは更新できない', async () => {
      await request(server)
        .put(`/posts/${postId}`)
        .send({ title: '更新後' })
        .expect(401);
    });

    it('他人の投稿は更新できない', async () => {
      const otherUser = await createUserAndLogin(app, 'other@example.com');

      await request(server)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ title: '更新後' })
        .expect(403);
    });
  });

  describe('DELETE /posts/:id', () => {
    let postId: number;

    beforeEach(async () => {
      const response = await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: '削除テスト', content: '削除内容' });
      postId = (response.body as PostResponse).id;
    });

    it('自分の投稿を削除できる', async () => {
      await request(server)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(server).get(`/posts/${postId}`).expect(404);
    });

    it('認証なしでは削除できない', async () => {
      await request(server).delete(`/posts/${postId}`).expect(401);
    });

    it('他人の投稿は削除できない', async () => {
      const otherUser = await createUserAndLogin(app, 'other2@example.com');

      await request(server)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(403);
    });
  });

  describe('GET /posts/search', () => {
    beforeEach(async () => {
      await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '東京旅行',
          content: '東京に行きました',
          location: '東京',
        });
      await request(server)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '大阪グルメ',
          content: '大阪で美味しいものを食べました',
          location: '大阪',
        });
    });

    it('キーワードで検索できる', async () => {
      const response = await request(server)
        .get('/posts/search?q=東京')
        .expect(200);

      const body = response.body as PostsListResponse;
      expect(body.posts.length).toBe(1);
      expect(body.posts[0].title).toBe('東京旅行');
    });

    it('場所で検索できる', async () => {
      const response = await request(server)
        .get('/posts/search?location=大阪')
        .expect(200);

      const body = response.body as PostsListResponse;
      expect(body.posts.length).toBe(1);
      expect(body.posts[0].title).toBe('大阪グルメ');
    });

    it('検索結果が0件の場合も正常に返す', async () => {
      const response = await request(server)
        .get('/posts/search?q=存在しない')
        .expect(200);

      const body = response.body as PostsListResponse;
      expect(body.posts.length).toBe(0);
    });
  });
});
