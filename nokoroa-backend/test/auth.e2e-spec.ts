import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { cleanupDatabase } from './setup';
import { LoginResponse, SignupResponse, UserProfile } from './types';
import { AppModule } from '../src/app.module';
import {
  AUTH_COOKIE_NAME,
  SESSION_HINT_COOKIE_NAME,
} from '../src/auth/auth-cookie';
import { OAUTH_STATE_COOKIE_NAME } from '../src/auth/oauth-state.store';
import { applySharedHttpSetup } from '../src/common/http-setup';

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
    // 本番(main.ts)と同じ共通設定(cookie-parser + ValidationPipe)を使う。
    // ここを本番と別に組むと、本番側の配線を消してもテストが緑のままになる。
    applySharedHttpSetup(app);
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
      // NODE_ENV=test は開発環境ではないので Secure が付く。
      // 属性の環境別の正しさは auth-cookie.spec.ts が担保する
      expect(setCookie).toMatch(/Secure/i);
    });

    it('ログイン状態ヒントは httpOnly にしない(フロントが同期で読むため)', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(201);

      const hint = findSetCookie(response, SESSION_HINT_COOKIE_NAME);
      expect(hint).toBeDefined();
      expect(hint).not.toMatch(/HttpOnly/i);
      // 秘密は入れない。寿命と送信条件は認証クッキーと揃える
      expect(hint).toMatch(new RegExp(`^${SESSION_HINT_COOKIE_NAME}=1;`));
      expect(hint).toMatch(/Max-Age=86400\b/i);
      expect(hint).toMatch(/SameSite=Lax/i);
    });

    it('トークンとヒントをキャッシュに残さない', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.headers['cache-control']).toBe('no-store');
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

    it('クッキーと Authorization が両方あるとクッキーが勝つ', async () => {
      // passport-jwt は最初に非 null を返した抽出器で確定するため、
      // クッキーがある限り Bearer は評価されない。Swagger でブラウザの
      // ログイン状態に引っ張られるのはこの性質によるので、契約として固定する
      const other = await request(server).post('/users/signup').send({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User',
      });
      expect(other.status).toBe(201);
      const otherLogin = await request(server).post('/auth/login').send({
        email: 'other@example.com',
        password: 'password123',
      });
      const otherToken = (otherLogin.body as LoginResponse).access_token;

      const response = await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect((response.body as UserProfile).email).toBe('me@example.com');
    });

    it('クッキーが壊れていると Authorization にフォールバックしない', async () => {
      // 上の「クッキー優先」の裏返し。壊れたクッキーが残っている端末では
      // 有効な Bearer を付けても 401 になる
      await request(server)
        .get('/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=invalid-token`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('本人の情報をキャッシュに残さない', async () => {
      const response = await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('クロスサイトからのリクエスト (Fetch Metadata)', () => {
    let authCookie: string;

    beforeEach(async () => {
      await request(server).post('/users/signup').send({
        email: 'crosssite@example.com',
        password: 'password123',
        name: 'Cross Site User',
      });
      const loginResponse = await request(server).post('/auth/login').send({
        email: 'crosssite@example.com',
        password: 'password123',
      });
      const setCookie = findSetCookie(loginResponse, AUTH_COOKIE_NAME);
      if (!setCookie) {
        throw new Error('ログインで認証クッキーが発行されていません');
      }
      authCookie = toCookieHeader(setCookie);
    });

    it('クロスサイトのトップレベル GET 遷移を拒否する', async () => {
      // SameSite=Lax はこの経路に Cookie を乗せるため、Lax だけでは防げない。
      // 攻撃者ページから window.open で保護 API を踏ませる CSRF を閉じる
      await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Sec-Fetch-Mode', 'navigate')
        .expect(403);
    });

    it('クロスサイトのフォーム POST でログインできない', async () => {
      // Nest は既定で urlencoded を受けるため、これが無いとクロスサイトの
      // HTML フォームから「攻撃者アカウントでログインさせる」ことができる
      await request(server)
        .post('/auth/login')
        .type('form')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Sec-Fetch-Mode', 'navigate')
        .send({ email: 'crosssite@example.com', password: 'password123' })
        .expect(403);
    });

    it('Google の認証開始とコールバックはクロスサイトでも通す', async () => {
      // Google からのリダイレクトはクロスサイトのトップレベル遷移で届くため、
      // ここを塞ぐと正規のログインが成立しない(代わりに state で検証する)
      const response = await request(server)
        .get('/auth/google')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Sec-Fetch-Mode', 'navigate');

      expect(response.status).not.toBe(403);
    });

    it('same-site(開発のポート違い)と same-origin は通す', async () => {
      await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .set('Sec-Fetch-Site', 'same-site')
        .expect(200);

      await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .set('Sec-Fetch-Site', 'same-origin')
        .expect(200);
    });

    it('ヘッダを送らないクライアント(curl / Swagger / supertest)は通す', async () => {
      // ブラウザは Sec-Fetch-Site を省略できないので、ヘッダ無しを通しても
      // 攻撃者が検査を回避する手段にはならない
      await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .expect(200);
    });
  });

  describe('Google OAuth の state', () => {
    it('認証開始時に state を発行し、URL にも載せる', async () => {
      const response = await request(server).get('/auth/google').expect(302);

      const stateCookie = findSetCookie(response, OAUTH_STATE_COOKIE_NAME);
      expect(stateCookie).toBeDefined();
      expect(stateCookie).toMatch(/HttpOnly/i);
      // コールバックはクロスサイトのトップレベル遷移なので Lax が必須
      expect(stateCookie).toMatch(/SameSite=Lax/i);

      const location = response.headers['location'];
      const state = new URL(location).searchParams.get('state');
      expect(state).toBeTruthy();
      // URL の state とクッキーの state が一致していること
      expect(toCookieHeader(stateCookie as string)).toBe(
        `${OAUTH_STATE_COOKIE_NAME}=${state}`,
      );
    });

    it('state クッキーが無いコールバックを拒否する', async () => {
      // 攻撃者が取得した code を被害者にトップレベル遷移させる
      // ログイン CSRF（セッション固定）を塞ぐ経路
      const response = await request(server).get(
        '/auth/google/callback?code=attacker-code&state=attacker-state',
      );

      expect(response.status).toBe(401);
      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeUndefined();
    });

    it('state が一致しないコールバックを拒否する', async () => {
      const start = await request(server).get('/auth/google').expect(302);
      const stateCookie = findSetCookie(start, OAUTH_STATE_COOKIE_NAME);
      if (!stateCookie) {
        throw new Error('state クッキーが発行されていません');
      }

      const response = await request(server)
        .get('/auth/google/callback?code=attacker-code&state=not-the-same')
        .set('Cookie', toCookieHeader(stateCookie));

      expect(response.status).toBe(401);
      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeUndefined();
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

      // ログイン状態ヒントも同時に消さないと、未ログインなのに
      // ログイン中として描画され /auth/me で 401 を引く
      const clearedHint = findSetCookie(response, SESSION_HINT_COOKIE_NAME);
      expect(clearedHint).toBeDefined();
      expect(clearedHint).toMatch(new RegExp(`^${SESSION_HINT_COOKIE_NAME}=;`));
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
