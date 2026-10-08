import { Server } from 'http';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
} from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { cleanupDatabase } from './setup';
import { LoginResponse, SignupResponse, UserProfile } from './types';
import { AppModule } from '../src/app.module';
import {
  AUTH_COOKIE_NAME,
  SESSION_HINT_COOKIE_NAME,
} from '../src/auth/auth-cookie';
import { GOOGLE_CALLBACK_PATH } from '../src/auth/google-callback-path';
import { OAUTH_STATE_COOKIE_NAME } from '../src/auth/oauth-state.store';
import { ALLOW_CROSS_SITE_NAVIGATION_KEY } from '../src/common/allow-cross-site-navigation.decorator';
import { API_GLOBAL_PREFIX } from '../src/common/api-prefix';

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

    it('OAuth 経路でもトップレベル遷移以外は拒否する', async () => {
      // 画像等の埋め込み(no-cors)でコールバックを叩かせると、
      // 被害者の進行中ログインの state を消して妨害できてしまう
      await request(server)
        .get('/auth/google/callback?code=x&state=y')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Sec-Fetch-Mode', 'no-cors')
        .expect(403);
    });

    it('Sec-Fetch-Site を送らないブラウザでも Origin で更新系を拒否する', async () => {
      // Safari 16.3 以下 / Firefox 89 以下は Sec-Fetch-Site を送らない。
      // ログイン CSRF を止めているのはこの検査だけなので、Origin で二重化する
      await request(server)
        .post('/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'crosssite@example.com', password: 'password123' })
        .expect(403);
    });

    it('許可オリジンからの更新系は通す', async () => {
      // FRONTEND_URL は test/env.ts で http://localhost:3000
      await request(server)
        .post('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'crosssite@example.com', password: 'password123' })
        .expect(201);
    });

    it('Origin 検査は参照系(GET)には効かせない', async () => {
      // GET にまで Origin 必須にすると、画像や外部からの参照が壊れる
      await request(server)
        .get('/auth/me')
        .set('Cookie', authCookie)
        .set('Origin', 'https://evil.example')
        .expect(200);
    });

    it('プレフィックスの無いルート直下も検査対象にする', async () => {
      // ミドルウェアだと setGlobalPrefix 配下にしかマウントされず、
      // ルート直下だけ素通りする。ガードにしているのでここも拒否される
      await request(server)
        .get('/')
        .set('Sec-Fetch-Site', 'cross-site')
        .expect(403);
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

    it('state クッキーが無いコールバックでは認証クッキーを発行しない', async () => {
      // 攻撃者が取得した code を被害者にトップレベル遷移させる
      // ログイン CSRF（セッション固定）を塞ぐ経路
      const response = await request(server).get(
        '/auth/google/callback?code=attacker-code&state=attacker-state',
      );

      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeUndefined();
      expect(findSetCookie(response, SESSION_HINT_COOKIE_NAME)).toBeUndefined();
    });

    it('state が一致しないコールバックでは認証クッキーを発行しない', async () => {
      const start = await request(server).get('/auth/google').expect(302);
      const stateCookie = findSetCookie(start, OAUTH_STATE_COOKIE_NAME);
      if (!stateCookie) {
        throw new Error('state クッキーが発行されていません');
      }

      const response = await request(server)
        .get('/auth/google/callback?code=attacker-code&state=not-the-same')
        .set('Cookie', toCookieHeader(stateCookie));

      expect(findSetCookie(response, AUTH_COOKIE_NAME)).toBeUndefined();
    });

    it('認証失敗はフロントへ戻す(API オリジンの生 JSON で行き止まりにしない)', async () => {
      // state 切れ・複数タブ・?code= 付き URL のリロードはやり直せる失敗なので、
      // ユーザーがアプリへ戻れる形にする。クエリは付けない
      const response = await request(server).get(
        '/auth/google/callback?code=x&state=y',
      );

      expect(response.status).toBe(302);
      expect(response.headers['location']).toBe(
        'http://localhost:3000/auth/callback',
      );
      expect(response.headers['location']).not.toContain('?');
    });

    it('state は 1 度使うと消える(再生を防ぐ)', async () => {
      const start = await request(server).get('/auth/google').expect(302);
      const stateCookie = findSetCookie(start, OAUTH_STATE_COOKIE_NAME);
      if (!stateCookie) {
        throw new Error('state クッキーが発行されていません');
      }

      const response = await request(server)
        .get('/auth/google/callback?code=x&state=y')
        .set('Cookie', toCookieHeader(stateCookie));

      const cleared = findSetCookie(response, OAUTH_STATE_COOKIE_NAME);
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${OAUTH_STATE_COOKIE_NAME}=;`));
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

/**
 * 他の E2E はプレフィックス無しでアプリを組むため、プレフィックス起因の退行を
 * 検出できない（経緯は `API_GLOBAL_PREFIX` の JSDoc）。ここだけ main.ts と
 * 同じ setGlobalPrefix を掛けて、その差を塞ぐ。
 *
 * 到達できたことを 302 まで固定するのが肝心。`not.toBe(403)` だけだと、
 * ルートの改名やマウント位置の変更で 404 になっても緑のままになる。
 */
describe('Auth (e2e, setGlobalPrefix 有り)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Google の認証開始はクロスサイトのトップレベル遷移でも通す', async () => {
    const response = await request(server)
      .get(`/${API_GLOBAL_PREFIX}/auth/google`)
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'navigate')
      .set('Sec-Fetch-Dest', 'document')
      .expect(302);

    expect(response.headers.location).toContain('accounts.google.com');
  });

  it('Google のコールバックはクロスサイトのトップレベル遷移でも通す', async () => {
    // Google からのリダイレクトはこの形で届く。403 だとログインが成立しない。
    // state は一致しないので、やり直し案内へのリダイレクトになる
    const response = await request(server)
      .get(`${GOOGLE_CALLBACK_PATH}?code=x&state=y`)
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'navigate')
      .set('Sec-Fetch-Dest', 'document')
      .expect(302);

    expect(response.headers.location).toContain('/auth/callback');
  });

  it('OAuth 経路でも埋め込みからの呼び出しは拒否する', async () => {
    await request(server)
      .get(`${GOOGLE_CALLBACK_PATH}?code=x&state=y`)
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'no-cors')
      .set('Sec-Fetch-Dest', 'image')
      .expect(403);
  });

  it('OAuth 以外のルートはプレフィックス付きでもクロスサイトを拒否する', async () => {
    await request(server)
      .get(`/${API_GLOBAL_PREFIX}/auth/me`)
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'navigate')
      .set('Sec-Fetch-Dest', 'document')
      .expect(403);
  });

  describe('クロスサイト許可ハンドラの棚卸し', () => {
    /**
     * 全コントローラを走査し、印が付いたハンドラを `Controller.method` の形で返す。
     *
     * 判定はガード（`FetchMetadataGuard`）と同じ truthy で行い、継承した
     * ハンドラも拾えるようプロトタイプチェーンを辿る。**検知はガードより
     * 緩くしてはいけない** — 緩いと「ガードは免除するのに一覧には出ない」
     * 状態が作れてしまい、この棚卸し自体が fail-open になる。
     */
    function collectMarkedHandlers(): {
      name: string;
      httpMethod: unknown;
    }[] {
      const scanner = new MetadataScanner();
      return app
        .get(DiscoveryService)
        .getControllers()
        .flatMap((wrapper) => {
          // インスタンスを解決できないコントローラ(request-scoped 等)は
          // 走査の外に落ちるため、黙って飛ばさず失敗させる
          expect(wrapper.instance).toBeDefined();
          const prototype = Object.getPrototypeOf(
            wrapper.instance as object,
          ) as object;

          return scanner
            .getAllMethodNames(prototype)
            .map((member) => ({
              member,
              handler: (prototype as Record<string, object>)[member],
            }))
            .filter(({ handler }) =>
              Reflect.getMetadata(ALLOW_CROSS_SITE_NAVIGATION_KEY, handler),
            )
            .map(({ member, handler }) => ({
              name: `${wrapper.metatype?.name ?? 'unknown'}.${member}`,
              httpMethod: Reflect.getMetadata(
                METHOD_METADATA,
                handler,
              ) as unknown,
            }));
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    function describeHttpMethod(httpMethod: unknown): string {
      return typeof httpMethod === 'number'
        ? (RequestMethod[httpMethod] ?? String(httpMethod))
        : 'HTTP メソッドデコレータなし';
    }

    it('印が付いているのは Google 認証の 2 本だけ', () => {
      // 一覧が変わったことに気づく手段がここしかない。
      // 増えている場合: そのハンドラ自身が CSRF を防げるか確認してから一覧を更新する。
      // 減っている場合: 印が外れた退行(Google ログインが 403 になる)。
      //   期待値を減らす前にデコレータの有無を確認すること。
      expect(collectMarkedHandlers().map((entry) => entry.name)).toEqual([
        'AuthController.googleAuth',
        'AuthController.googleAuthRedirect',
      ]);
    });

    it('印が付いたハンドラはすべて GET', () => {
      // 印は「クロスサイトのトップレベル遷移」を受けるためのもので、それは
      // 定義上 GET。更新系に付いた時点で設計外の使われ方をしており、残る防御も
      // Origin 検査 1 枚だけになる。一覧の更新だけでは回避できないよう、
      // ここで機械的に止める。
      const marked = collectMarkedHandlers();
      expect(marked.length).toBeGreaterThan(0);
      // 落ちたときに「どのハンドラに何で付いたか」が読めるよう、
      // RequestMethod の数値ではなく名前で出す
      expect(
        marked
          .filter((entry) => entry.httpMethod !== RequestMethod.GET)
          .map(
            (entry) => `${entry.name}: ${describeHttpMethod(entry.httpMethod)}`,
          ),
      ).toEqual([]);
    });
  });
});
