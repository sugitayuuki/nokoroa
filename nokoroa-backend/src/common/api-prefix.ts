/**
 * 全ルートに掛かるグローバルプレフィックス。
 *
 * **この定数が存在する理由（以降のファイルはここを参照する）**:
 * かつてクロスサイト許可の判定をパス literal で持っており、`setGlobalPrefix` で
 * 付くこのプレフィックスの分だけずれて、本番・ローカルとも Google ログインが
 * 403 になった。E2E はアプリを自前で組んでプレフィックスを掛けないため、
 * **テストだけが緑のまま**この乖離を見逃した。
 *
 * バックエンド内ではここを参照し、literal を書き写さないこと
 * （`GOOGLE_CALLBACK_URL` を組む箇所は `GOOGLE_CALLBACK_PATH` 経由で参照する）。
 *
 * ただしこれはバックエンド**内**の単一真実源にすぎない。同じ値は
 * `nokoroa-frontend/src/lib/apiConfig.ts` と terraform（ALB のパスルール /
 * `GOOGLE_CALLBACK_URL`）にも literal で存在し、ここを変えても追随しない。
 * 値を変えるときは三者すべてを合わせること。
 */
export const API_GLOBAL_PREFIX = 'api';
