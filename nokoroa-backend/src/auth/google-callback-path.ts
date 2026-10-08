import { API_GLOBAL_PREFIX } from '../common/api-prefix';

/**
 * `AuthController` の `@Get('google/callback')` が実際にマウントされるパス。
 *
 * E2E はこの定数からリクエスト URL を組むので、「ここに本当にルートがある」ことは
 * テストで担保される（定数を間違えれば E2E が 404 で落ちる）。残るのは Google へ
 * 登録した `GOOGLE_CALLBACK_URL` が同じパスを指しているかで、それを起動時に
 * 突き合わせるのが下の assert。
 */
export const GOOGLE_CALLBACK_PATH = `/${API_GLOBAL_PREFIX}/auth/google/callback`;

/**
 * `GOOGLE_CALLBACK_URL` のパスが実際のマウント先と一致することを起動時に確かめる。
 *
 * ずれていても Google の同意画面までは正常に進むため、**実ユーザーがログインに
 * 失敗するまで誰も気づけない**（ALB もヘルスチェックもこの経路を踏まない）。
 * 実際にそれで落ちた（経緯は `API_GLOBAL_PREFIX` の JSDoc）ので、検知を
 * デプロイ時まで前倒しする。
 *
 * 見るのはパスだけ。スキームとホストは環境ごとに正解が違う（開発はフロントと
 * ポートが別）ため、ここでは判定できない。値が無い場合は何もしない
 * （必須かどうかは GoogleStrategy の責務）。
 */
export function assertGoogleCallbackUrlMatchesRoute(
  callbackUrl: string | undefined,
): void {
  if (!callbackUrl) {
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(callbackUrl).pathname;
  } catch {
    throw new Error(
      `GOOGLE_CALLBACK_URL ("${callbackUrl}") を URL として解釈できません。`,
    );
  }

  // Express が省略を許すのは末尾スラッシュ 1 個まで。2 個以上は実際に 404 に
  // なるので、ここで通してしまうと assert の目的（ログインだけが落ちる形の
  // 設定ミスを起動時に捕まえる）を外す。
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (normalized !== GOOGLE_CALLBACK_PATH) {
    throw new Error(
      `GOOGLE_CALLBACK_URL のパス "${pathname}" が、実際のマウント先 ` +
        `"${GOOGLE_CALLBACK_PATH}" と一致しません。` +
        'この不一致は Google ログインの失敗としてのみ表面化し、' +
        'ヘルスチェックでは検知できません。',
    );
  }
}
