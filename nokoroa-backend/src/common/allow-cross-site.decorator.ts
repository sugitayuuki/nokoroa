import { SetMetadata } from '@nestjs/common';

/**
 * 素の `'allowCrossSite'` だと、他のデコレータやライブラリが同名キーに truthy を
 * 置いた瞬間、そのハンドラが無言で検査の外に出る（衝突時に fail-open）。
 */
export const ALLOW_CROSS_SITE_KEY = 'nokoroa:allow-cross-site';

/**
 * クロスサイトからのトップレベル遷移を許可するハンドラの印（`FetchMetadataGuard` が読む）。
 *
 * 許可対象をパス文字列で持たない。`setGlobalPrefix('api')` があるため実際の
 * `req.path` は `/api/...` になり、パスを literal で持つと許可レーンに乗らず
 * 正規の Google ログインが 403 になる。E2E は自前でアプリを組んでプレフィックスを
 * 掛けないため**テストだけが緑のまま**この乖離を見逃す（実際に起きた）。
 * ハンドラ側に印を付ければ、プレフィックスの有無とマウント位置から独立する。
 *
 * 印を付けても外れるのは `Sec-Fetch-Site: cross-site` の拒否だけで、`Origin` 検査は
 * 効いたまま。許可されるのもトップレベル遷移に限る（判定は `FetchMetadataGuard`）。
 * それでも**そのハンドラ自身が CSRF を防ぐ手段を持っていること**が前提になる
 * （Google 認証では OAuth の `state` 検証 = `OAuthStateCookieStore`）。
 *
 * ハンドラ専用にしているのは、コントローラ単位で付けられると後から足したルートが
 * 無言で検査の外に出るため。`FetchMetadataGuard` 側もハンドラのメタデータしか読まない。
 */
export const AllowCrossSite = (): MethodDecorator =>
  SetMetadata(ALLOW_CROSS_SITE_KEY, true);
