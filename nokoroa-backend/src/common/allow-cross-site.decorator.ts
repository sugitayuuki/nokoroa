import { SetMetadata } from '@nestjs/common';

/**
 * 素の `'allowCrossSite'` だと、他のデコレータやライブラリが同名キーに truthy を
 * 置いた瞬間、そのハンドラが無言で検査の外に出る（衝突時に fail-open）。
 */
export const ALLOW_CROSS_SITE_KEY = 'nokoroa:allow-cross-site';

/**
 * クロスサイトからのトップレベル遷移を受け付けるハンドラの印。
 *
 * **この印を付けてよい条件**（どう判定されるかは `FetchMetadataGuard`）:
 *
 * - そのハンドラ自身が CSRF を防ぐ手段を持っていること。Google 認証では
 *   OAuth の `state` 検証（`OAuthStateCookieStore`）がそれに当たる。
 * - 副作用を持たない GET であること。`Origin` 検査は更新系メソッドにしか
 *   掛からず、ブラウザは GET 遷移に `Origin` を付けない。つまり**印を付けた
 *   GET はクロスサイトから素通りする**ので、「GET だから安全」は成り立たない。
 * - 埋め込み（iframe 等）から叩かれても困らないこと。ガードは `Sec-Fetch-*`
 *   を送るクライアントに限ってトップレベル遷移に絞るが、ヘッダを送らない
 *   クライアントには効かない。
 *
 * 許可対象をパス文字列で持たないのは、グローバルプレフィックスが付くと実際の
 * `req.path` がずれ、許可レーンに乗らなくなるため（プレフィックスを掛けない E2E
 * だけが再現せず、テストが緑のまま Google ログインが 403 になった）。
 *
 * ハンドラ専用にしているのは、コントローラ単位で付けられると後から足したルートが
 * 無言で検査の外に出るため。**メソッドを差し替える種類のデコレータより下に置く**こと
 * （印は関数オブジェクトに付くので、上で差し替えられると落ちる）。
 */
export const AllowCrossSiteNavigation = (): MethodDecorator =>
  SetMetadata(ALLOW_CROSS_SITE_KEY, true);
