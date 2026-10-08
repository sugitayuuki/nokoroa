import { SetMetadata } from '@nestjs/common';

/**
 * 素のキー名（`'allowCrossSite'` 等）だと、他のデコレータやライブラリが同名キーに
 * truthy を置いた瞬間、そのハンドラが無言で検査の外に出る（衝突時に fail-open）。
 */
export const ALLOW_CROSS_SITE_NAVIGATION_KEY =
  'nokoroa:allow-cross-site-navigation';

/**
 * クロスサイトからのトップレベル遷移を受け付けるハンドラの「印」。
 * 以降この仕組みは一貫して「印」と呼ぶ（判定の実装は `FetchMetadataGuard`）。
 *
 * **印を付けてよい条件**:
 *
 * - そのハンドラ自身が CSRF を防ぐ手段を持っていること。Google 認証では
 *   OAuth の `state` 検証（`OAuthStateCookieStore`）がそれに当たる。
 * - 副作用を持たない GET であること。`Origin` 検査は更新系メソッドにしか
 *   掛からず、ブラウザは GET 遷移に `Origin` を付けない。つまり**印を付けた
 *   GET はクロスサイトから素通りする**ので、「GET だから安全」は成り立たない。
 * - 埋め込み（iframe 等）から叩かれても困らないこと。トップレベル遷移に絞れるのは
 *   `Sec-Fetch-Mode` / `Sec-Fetch-Dest` を送るクライアントに限られる。
 *
 * 許可対象をパス文字列で持たないのは、グローバルプレフィックスとずれるため
 * （経緯は `API_GLOBAL_PREFIX` の JSDoc）。
 *
 * ハンドラ専用にしているのは、コントローラ単位で付けられると後から足したルートが
 * 無言で検査の外に出るため。**メソッドを差し替える種類のデコレータより下に置く**こと
 * （印は関数オブジェクトに付くので、上で差し替えられると落ちる）。
 */
export const AllowCrossSiteNavigation = (): MethodDecorator =>
  SetMetadata(ALLOW_CROSS_SITE_NAVIGATION_KEY, true);
