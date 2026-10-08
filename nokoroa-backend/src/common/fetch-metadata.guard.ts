import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ALLOW_CROSS_SITE_KEY } from './allow-cross-site.decorator';

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
 *   **印が付いていても免除しない** — 印は「クロスサイトから到達してよい」という
 *   宣言であって「Origin を信用してよい」ではないため。
 * - **Sec-Fetch-Site**: `cross-site` なら拒否。GET 遷移（`Origin` が付かない）を
 *   閉じるのはこちらだけなので、**上記 1 は Sec-Fetch-Site を送るブラウザに限って
 *   閉じている**（README の「残っている面」に明記）。
 *
 * 唯一の例外が `@AllowCrossSiteNavigation` を付けたハンドラで、ここだけは
 * `cross-site` でも通す。ただし `Sec-Fetch-Mode` / `Sec-Fetch-Dest` が
 * トップレベル遷移を示す場合に限る（どちらも送らないクライアントは、他の検査と
 * 同じく「ブラウザ以外」として通す）。印を付けてよい条件は
 * `AllowCrossSiteNavigation` の JSDoc。
 *
 * どちらのヘッダも無いリクエスト（curl / Swagger / supertest / サーバー間）は通す。
 * ここを必須にすると API クライアントが全滅する。
 *
 * ミドルウェアではなくガードにしているのは、`setGlobalPrefix` があっても
 * 全ルートに等しく掛かるため（`forRoutes('*')` のミドルウェアはプレフィックス配下に
 * 閉じてマウントされ、`GET /api` だけ素通りする）。あわせて LoggerMiddleware より
 * 後に走るので、拒否したリクエストもアクセスログに残る。
 */
@Injectable()
export class FetchMetadataGuard implements CanActivate {
  private readonly logger = new Logger(FetchMetadataGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const origin = req.header('origin');
    if (
      origin &&
      UNSAFE_METHODS.has(req.method) &&
      !this.isAllowedOrigin(origin, req)
    ) {
      this.reject(req, `disallowed origin ${origin}`);
    }

    // ヘッダ無し = ブラウザ以外。same-origin / none（アドレスバー直打ち・
    // ブックマーク・外部アプリからのリンク）は自サイト扱い。
    // same-site は開発環境（フロント localhost:3000 → API localhost:4000。
    // Cookie と同じくポートはサイトの構成要素ではない）で必要。
    if (req.header('sec-fetch-site') !== 'cross-site') {
      return true;
    }

    // 印はハンドラ単位でのみ読む（理由は AllowCrossSiteNavigation の JSDoc）。
    const handler = context.getHandler();
    if (!this.reflector.get<boolean>(ALLOW_CROSS_SITE_KEY, handler)) {
      // 解決先を添える。「印が外れた」事故（今回の 403 の再発）と
      // 「正常な遮断」はこれが無いとログ上で見分けられない。
      this.reject(
        req,
        `sec-fetch-site=cross-site and ${context.getClass().name}.${handler.name} ` +
          'has no @AllowCrossSiteNavigation',
      );
    }

    // 印が付いていてもトップレベル遷移に限る。埋め込み（画像・iframe 等）で
    // コールバックを叩かせて進行中ログインの state を壊す経路を塞ぐ。
    // ヘッダが無い場合は他の検査と同じく通す（ブラウザ以外とみなす）。
    const mode = req.header('sec-fetch-mode');
    const dest = req.header('sec-fetch-dest');
    if ((mode && mode !== 'navigate') || (dest && dest !== 'document')) {
      this.reject(
        req,
        'cross-site allowed route needs a top-level navigation ' +
          `(sec-fetch-mode=${mode ?? 'none'} sec-fetch-dest=${dest ?? 'none'})`,
      );
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
