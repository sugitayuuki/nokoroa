# セキュリティガイドライン

## 認証セキュリティ

### 現在の実装
- JWTトークンはlocalStorageに保存（セキュリティリスクあり）
- トークンの自動リフレッシュ機能
- 自動ログアウト機能（60分）

### セキュリティリスク
1. **XSS攻撃によるトークン盗用**
   - localStorageはJavaScriptからアクセス可能
   - 悪意のあるスクリプトによりトークンが盗まれる可能性

2. **CSRF攻撃**
   - 現在はCSRF対策が不十分
   - 悪意のあるサイトからの不正リクエスト

### 推奨改善策

#### 1. httpOnlyクッキーの使用
```typescript
// バックエンドでのクッキー設定例
res.cookie('authToken', token, {
  httpOnly: true,
  secure: true, // HTTPS必須
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15分
});
```

#### 2. トークンリフレッシュ戦略
```typescript
// 短い有効期限のアクセストークン + 長期間有効なリフレッシュトークン
interface TokenPair {
  accessToken: string; // 15分
  refreshToken: string; // 7日
}
```

#### 3. CSRF対策
```typescript
// CSRFトークンの実装
const csrfToken = await fetch('/api/csrf-token');
// リクエストヘッダーに含める
headers['X-CSRF-Token'] = csrfToken;
```

## データ保護

### 機密情報の取り扱い
- パスワードは平文で保存しない
- 個人情報は適切に暗号化
- APIキーは環境変数で管理

### 入力値検証
```typescript
// フロントエンドとバックエンドの両方で検証
const validateInput = (input: string): boolean => {
  // SQLインジェクション対策
  // XSS対策
  return isValid;
};
```

## 通信セキュリティ

### HTTPS強制
- 本番環境では必ずHTTPS使用
- Mixed Content防止

### APIセキュリティ
```typescript
// レート制限の実装
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
};
```

## セキュリティ監査

### 定期的なチェック項目
1. 依存関係の脆弱性チェック
   ```bash
   npm audit
   ```

2. セキュリティヘッダーの確認
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options

3. 認証フローのテスト
   - 不正アクセスの防止
   - セッションハイジャック対策

### ログ監視
```typescript
// セキュリティイベントのログ記録
const logSecurityEvent = (event: string, details: any) => {
  console.warn(`[Security] ${event}`, {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ...details,
  });
};
```

## 実装優先順位

### 高優先度
1. httpOnlyクッキーへの移行
2. CSRFトークンの実装
3. トークンリフレッシュ機能

### 中優先度
1. セッション管理の改善
2. レート制限の実装
3. セキュリティヘッダーの設定

### 低優先度
1. 詳細な監査ログ
2. 異常検出システム
3. セキュリティダッシュボード

## 移行計画

### Phase 1: 基盤整備
- SecureAuthManagerの実装完了 ✅
- 既存認証システムとの互換性維持 ✅

### Phase 2: サーバー側実装
- httpOnlyクッキー対応のAPIエンドポイント作成
- CSRFトークン生成・検証機能

### Phase 3: フロントエンド移行
- クッキーベース認証への切り替え
- 既存のlocalStorage使用箇所の更新

### Phase 4: セキュリティ強化
- レート制限の実装
- セキュリティ監査機能の追加