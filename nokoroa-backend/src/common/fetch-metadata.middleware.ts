import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * クロスサイトから到達してよい唯一の経路。
 * Google の認証画面からのリダイレクトはクロスサイトのトップレベル遷移で届くため、
 * ここだけは通す必要がある（代わりに state で CSRF を検証している）。
 *
 * `/api` を省略可能にしているのは、本番は setGlobalPrefix('api') が付くのに対し
 * E2E はプレフィックス無しでアプリを組むため。片方だけに合わせると
 * 「正規の Google ログインが 403 になる」か「テストが通らない」のどちらかになる。
 */
const CROSS_SITE_ALLOWED_PATH_PATTERN =
  /^(?:\/api)?\/auth\/google(?:\/callback)?$/;

/** 画像はクロスサイト参照を許す（main.ts で CORP も緩めている）。 */
const CROSS_SITE_ALLOWED_PREFIXES = ['/uploads/'];

/**
 * Fetch Metadata によるリソース分離。
 *
 * JWT を Cookie に移したことで、ブラウザがリクエストに認証情報を自動で付けるように
 * なった。`SameSite=Lax` はクロスサイトの POST/PUT/DELETE を止めるが、
 * **クロスサイトのトップレベル GET 遷移には Cookie を乗せる**。そのため Lax だけでは
 * 「攻撃者のページから window.open で課金 API を踏ませる」類の CSRF が残る
 * （差分前は Authorization ヘッダ必須だったので原理的に不可能だった面）。
 *
 * Sec-Fetch-Site を見てクロスサイト由来のリクエストを落とすことで、この面を閉じる。
 *
 * ヘッダが無いクライアント（curl / Swagger / supertest / 古いブラウザ）は通す。
 * ブラウザはこのヘッダの送信を省略できないため、攻撃者が「ヘッダを消して回避する」
 * ことはできない。逆にヘッダ必須にすると API クライアントが全滅する。
 */
@Injectable()
export class FetchMetadataMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const site = req.header('sec-fetch-site');

    // ヘッダ無し = ブラウザ以外。same-origin / none（アドレスバー直打ち）は自サイト。
    if (!site || site === 'same-origin' || site === 'none') {
      next();
      return;
    }

    // 開発環境はフロント localhost:3000 → API localhost:4000 で same-site になる
    // （Cookie と同じくポートはサイトの構成要素ではない）。本番は同一オリジン。
    if (site === 'same-site') {
      next();
      return;
    }

    // originalUrl を使う: このミドルウェアはパス付きでマウントされるため、
    // req.path はマウント位置からの相対パスになり '/auth/google' と一致しない。
    const path = req.originalUrl.split('?')[0];
    if (
      CROSS_SITE_ALLOWED_PATH_PATTERN.test(path) ||
      CROSS_SITE_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
    ) {
      next();
      return;
    }

    next(
      new ForbiddenException('Cross-site requests are not allowed by this API'),
    );
  }
}
