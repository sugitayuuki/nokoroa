// e2e は AppModule を丸ごと読み込むため、起動時に必須の環境変数を用意する。
// 実行者の環境に依存させないよう、未設定のときだけテスト用の値を入れる。
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-test-jwt-secret-value-at-least-32-chars';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
