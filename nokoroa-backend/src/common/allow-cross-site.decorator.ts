import { SetMetadata } from '@nestjs/common';

export const ALLOW_CROSS_SITE_KEY = 'allowCrossSite';

/**
 * クロスサイトからのトップレベル遷移を許可するルートの印（`FetchMetadataGuard` が読む）。
 *
 * 許可対象をパス文字列で持たない。`setGlobalPrefix('api')` があるため実際の
 * `req.path` は `/api/...` になり、パスを literal で持つと**本番だけ**許可レーンに
 * 乗らず正規の Google ログインが 403 になる（プレフィックスを持たない E2E では
 * 再現しないため、テストが緑のまま壊れる）。ルート側に印を付ければ、
 * プレフィックスの有無とマウント位置から独立する。
 *
 * 付けたルートは `Sec-Fetch-Site: cross-site` を素通しするため、**そのルート自身が
 * CSRF を防ぐ手段を持っていること**が前提（Google 認証では OAuth の `state` 検証）。
 *
 * ハンドラ専用にしているのは、コントローラ単位で付けられると後から足したルートが
 * 無言で検査の外に出るため。
 */
export const AllowCrossSite = (): MethodDecorator =>
  SetMetadata(ALLOW_CROSS_SITE_KEY, true);
