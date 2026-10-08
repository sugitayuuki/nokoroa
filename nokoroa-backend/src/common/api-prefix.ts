/**
 * 全ルートに掛かるグローバルプレフィックス。
 *
 * バックエンド内（`main.ts` と E2E）ではここを参照し、literal を書き写さないこと。
 * 書き写すと「本番は /api、テストはプレフィックス無し」という乖離が生まれ、
 * パスがずれる退行をテストが緑のまま見逃す（Google ログインが 403 になる形で
 * 実際に起きた）。
 *
 * ただしこれはバックエンド**内**の単一真実源にすぎない。同じ値は
 * `nokoroa-frontend/src/lib/apiConfig.ts` と terraform（ALB のパスルール /
 * `GOOGLE_CALLBACK_URL`）にも literal で存在し、ここを変えても追随しない。
 * 値を変えるときは三者すべてを合わせること。
 */
export const API_GLOBAL_PREFIX = 'api';
