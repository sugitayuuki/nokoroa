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
