import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * クロスサイトから到達してよい唯一の経路。
 * Google の認証画面からのリダイレクトはクロスサイトのトップレベル遷移で届くため、
 * ここだけは通す必要がある（代わりに state で CSRF を検証している）。
 */
const CROSS_SITE_ALLOWED_PATH_PATTERN = /^\/auth\/google(?:\/callback)?$/;

/** 副作用を持つメソッド。Origin の検査を強制する対象。 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Fetch Metadata + Origin によるクロスサイトリクエストの拒否。
 *
 * JWT を Cookie に移したことで、ブラウザがリクエストに認証情報を自動で付けるように
 * なった。`SameSite=Lax` はクロスサイトの POST / PUT / DELETE に Cookie を乗せないが、
 * 次の 2 つは Lax では防げない。
 *
 * 1. **クロスサイトのトップレベル GET 遷移** — Lax は Cookie を乗せる。
 *    攻撃者ページから `window.open` で保護 API を踏ませられる。
 * 2. **クロスサイトのフォーム POST でのログイン** — ログインは既存 Cookie を必要とせず、
 *    `Set-Cookie` の受理は SameSite の制御対象外。NestJS は既定で urlencoded を
 *    受けるため、被害者を「攻撃者のアカウントでログイン済み」にできる。
 *
 * 判定は 2 段。
 *
 * - **Origin**（副作用のあるメソッドのみ）: ブラウザはクロスオリジンの POST 等に
 *   必ず `Origin` を付け、JS から取り除けない。許可オリジン以外なら拒否する。
 *   Sec-Fetch-Site を送らない古いブラウザ（Safari 16.3 以下 / Firefox 89 以下）でも
 *   こちらが効くため、上記 2 のログイン CSRF はここで閉じる。
 * - **Sec-Fetch-Site**: `cross-site` なら拒否。GET 遷移（`Origin` が付かない）を
 *   閉じるのはこちらだけなので、**上記 1 は Sec-Fetch-Site を送るブラウザに限って
 *   閉じている**（README の「残っている面」に明記）。
 *
 * どちらのヘッダも無いリクエスト（curl / Swagger / supertest / サーバー間）は通す。
 * ここを必須にすると API クライアントが全滅する。
 *
 * ミドルウェアではなくガードにしているのは、`setGlobalPrefix('api')` があっても
 * 全ルートに等しく掛かるため（`forRoutes('*')` のミドルウェアはプレフィックス配下に
 * 閉じてマウントされ、`GET /api` だけ素通りする）。あわせて LoggerMiddleware より
 * 後に走るので、拒否したリクエストもアクセスログに残る。
 */
@Injectable()
export class FetchMetadataGuard implements CanActivate {
  private readonly logger = new Logger(FetchMetadataGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path;

    // Google 認証の往復はクロスサイトで届くため、ここだけは通す。
    // ただしトップレベル遷移に限る: 画像等の埋め込み（no-cors）で
    // コールバックを叩かせて進行中ログインの state を壊す経路を塞ぐ。
    if (CROSS_SITE_ALLOWED_PATH_PATTERN.test(path)) {
      const mode = req.header('sec-fetch-mode');
      if (!mode || mode === 'navigate') {
        return true;
      }
      this.reject(req, `oauth path with sec-fetch-mode=${mode}`);
    }

    const origin = req.header('origin');
    if (
      origin &&
      UNSAFE_METHODS.has(req.method) &&
      !this.isAllowedOrigin(origin, req)
    ) {
      this.reject(req, `disallowed origin ${origin}`);
    }

    const site = req.header('sec-fetch-site');
    // ヘッダ無し = ブラウザ以外。same-origin / none（アドレスバー直打ち・
    // ブックマーク・外部アプリからのリンク）は自サイト扱い。
    // same-site は開発環境（フロント localhost:3000 → API localhost:4000。
    // Cookie と同じくポートはサイトの構成要素ではない）で必要。
    if (site === 'cross-site') {
      this.reject(req, 'sec-fetch-site=cross-site');
    }

    return true;
  }

  /** 全経路のブロッカーなので、拒否は必ず観測できるようにしておく。 */
  private reject(req: Request, reason: string): never {
    this.logger.warn(`Blocked ${req.method} ${req.path}: ${reason}`);
    throw new ForbiddenException(
      'Cross-site requests are not allowed by this API',
    );
  }

  private isAllowedOrigin(origin: string, req: Request): boolean {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    if (origin === frontendUrl) {
      return true;
    }
    // Swagger の "Try it out" など、API と同一オリジンからの呼び出し
    const host = req.headers.host;
    return (
      host !== undefined &&
      (origin === `https://${host}` || origin === `http://${host}`)
    );
  }
}
