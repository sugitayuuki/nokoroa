// e2e は AppModule を丸ごと読み込むため、起動時に必須の環境変数を用意する。
// 実行者の環境に依存させないよう、未設定のときだけテスト用の値を入れる。
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-test-jwt-secret-value-at-least-32-chars';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

// GoogleStrategy は clientID が無いと DI 時に throw するため、
// AuthModule を含む AppModule は未設定だと起動できない。
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'e2e-client-id';
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-client-secret';
process.env.GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ??
  'http://localhost:4000/auth/google/callback';

// e2e は cleanupDatabase() で全テーブルを deleteMany する。PrismaClient は
// DATABASE_URL 未指定なら .env を自動で読むため、開発用 DB が繋がっていると
// 開発データを消してしまう。接続先がテスト用であることを起動前に確認する。
assertTestDatabase();

function assertTestDatabase(): void {
  if (process.env.E2E_ALLOW_UNSAFE_DB === '1') return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'e2e: DATABASE_URL が未設定です。テスト用 DB を明示してください。\n' +
        '例: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nokoroa_test" npm run test:e2e',
    );
  }

  // パス先頭の "/" を除いた最初のセグメントがデータベース名。
  let database: string;
  try {
    database = new URL(url).pathname.replace(/^\//, '').split('/')[0];
  } catch {
    throw new Error('e2e: DATABASE_URL を URL として解釈できません。');
  }

  if (!/test/i.test(database)) {
    throw new Error(
      `e2e: 接続先 "${database}" がテスト用 DB に見えません（名前に "test" を含みません）。\n` +
        'e2e は全テーブルを削除するため中断しました。テスト用 DB を指定してください。\n' +
        '意図的に実行する場合のみ E2E_ALLOW_UNSAFE_DB=1 を付けてください。',
    );
  }
}
