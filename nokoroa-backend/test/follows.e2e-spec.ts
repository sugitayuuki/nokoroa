import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { createUserAndLogin } from './helpers';
import { cleanupDatabase } from './setup';
import {
  FollowCheckResponse,
  FollowersResponse,
  FollowingResponse,
  FollowResponse,
  FollowStatsResponse,
} from './types';
import { AppModule } from '../src/app.module';

describe('Follows (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let user1Token: string;
  let user1Id: number;
  let user2Id: number;

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
    const user1 = await createUserAndLogin(
      app,
      'user1@example.com',
      'password123',
      'User One',
    );
    user1Token = user1.accessToken;
    user1Id = user1.userId;

    const user2 = await createUserAndLogin(
      app,
      'user2@example.com',
      'password123',
      'User Two',
    );
    user2Id = user2.userId;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  describe('POST /follows/:userId', () => {
    it('他のユーザーをフォローできる', async () => {
      const response = await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(201);

      const body = response.body as FollowResponse;
      expect(body.success).toBe(true);
    });

    it('認証なしではフォローできない', async () => {
      await request(server).post(`/follows/${user2Id}`).expect(401);
    });

    it('自分自身はフォローできない', async () => {
      await request(server)
        .post(`/follows/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);
    });

    it('存在しないユーザーはフォローできない', async () => {
      await request(server)
        .post('/follows/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });

  describe('DELETE /follows/:userId', () => {
    it('フォローを解除できる', async () => {
      await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const response = await request(server)
        .delete(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const body = response.body as FollowResponse;
      expect(body.success).toBe(true);
    });

    it('認証なしではフォロー解除できない', async () => {
      await request(server).delete(`/follows/${user2Id}`).expect(401);
    });
  });

  describe('GET /follows/check/:userId', () => {
    it('フォロー中の場合trueを返す', async () => {
      await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const response = await request(server)
        .get(`/follows/check/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const body = response.body as FollowCheckResponse;
      expect(body.isFollowing).toBe(true);
    });

    it('フォローしていない場合falseを返す', async () => {
      const response = await request(server)
        .get(`/follows/check/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const body = response.body as FollowCheckResponse;
      expect(body.isFollowing).toBe(false);
    });
  });

  describe('GET /follows/:userId/followers', () => {
    it('フォロワー一覧を取得できる', async () => {
      await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const response = await request(server)
        .get(`/follows/${user2Id}/followers`)
        .expect(200);

      const body = response.body as FollowersResponse;
      expect(body.followers).toBeDefined();
      expect(body.followers.length).toBe(1);
      expect(body.followers[0].id).toBe(user1Id);
    });
  });

  describe('GET /follows/:userId/following', () => {
    it('フォロー中一覧を取得できる', async () => {
      await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const response = await request(server)
        .get(`/follows/${user1Id}/following`)
        .expect(200);

      const body = response.body as FollowingResponse;
      expect(body.following).toBeDefined();
      expect(body.following.length).toBe(1);
      expect(body.following[0].id).toBe(user2Id);
    });
  });

  describe('GET /follows/:userId/stats', () => {
    it('フォロー統計を取得できる', async () => {
      await request(server)
        .post(`/follows/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const response = await request(server)
        .get(`/follows/${user2Id}/stats`)
        .expect(200);

      const body = response.body as FollowStatsResponse;
      expect(body.followersCount).toBe(1);
      expect(body.followingCount).toBe(0);
    });
  });
});
