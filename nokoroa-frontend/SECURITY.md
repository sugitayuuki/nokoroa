# セキュリティガイドライン

## 認証セキュリティ

### 現在の実装
- JWT は **httpOnly クッキー** `nokoroa_token` に保存（属性は `nokoroa-backend/src/auth/auth-cookie.ts` が単一の正）
  - `HttpOnly` / `SameSite=Lax` / `Path=/`、`Secure` は開発環境以外で付与
  - 寿命は JWT の有効期限（1 日）と同じ。`AUTH_COOKIE_MAX_AGE_MS` から `expiresIn` を導出しているのでずれない
- フロントエンドはトークンを保持しない（`localStorage` には保存しない）
  - ログイン状態の表示判定にだけ、秘密を含まない非 httpOnly クッキー `nokoroa_session=1` を使う
- 自社 API への fetch はすべて `credentials: 'include'`（`lib/apiConfig.ts` の `API_FETCH_OPTIONS`）
- ログアウトは `POST /api/auth/logout`（httpOnly クッキーはサーバーしか消せない）
- トークンの自動リフレッシュ・自動ログアウト（60分）は**未実装**

### 対応済みのリスク
1. **XSS によるトークン盗用** — `HttpOnly` により JavaScript から読めない
2. **URL / ログへのトークン露出** — Google コールバックはクエリにトークンを載せず、着地後に `GET /api/auth/me` で本人を取得する
3. **CSRF** — 多層で閉じている（`nokoroa-backend/src/common/fetch-metadata.guard.ts`）
   - `SameSite=Lax`: クロスサイトの POST / PUT / DELETE にクッキーを乗せない
   - `Origin` の検査（更新系メソッドのみ）: ログイン CSRF を止める。
     ログインは既存クッキーを必要とせず `Set-Cookie` の受理も `SameSite` の対象外なので、Lax では止まらない
   - `Sec-Fetch-Site` の検査: Lax が通してしまう**クロスサイトのトップレベル GET 遷移**を止める
   - OAuth の `state`（`nokoroa-backend/src/auth/oauth-state.store.ts`）: コールバックが本人の開始した認証の続きであることを検証し、強制セッション固定を防ぐ
4. **Google アカウントの不正連携** — `email_verified` が true でない場合はログインを拒否（未確認メールでの既存アカウント乗っ取りを防ぐ）

### 残っているリスク
1. **トークンの失効ができない** — リフレッシュトークンと失効リストが未実装。
   `POST /api/auth/logout` はクッキーを消すだけで、発行済み JWT は有効期限（1 日）まで有効なまま
2. **メールアドレス確認のない signup** — パスワード登録にメール確認が無いため、
   「他人のメールアドレスで先に登録し、後からその人の Google ログインで紐付けられるのを待つ」経路が残っている
   （`email_verified` チェックは Google 側の未確認メールだけを塞いでいる）
3. **印を付けたハンドラ** — `@AllowCrossSiteNavigation()`（Google 認証の往復）はクロスサイトの
   トップレベル遷移を受け付ける。コールバック側で CSRF を閉じているのは OAuth の `state` 検証のみで、
   これを緩めるとクロスサイト拒否の穴が同時に開く。開始側は資格情報を発行しないことが根拠で、
   踏まれても影響は進行中ログインの `state` 上書き（やり直し）まで。
   印の前提と残る面は README のセキュリティ節を参照
4. **同一サイト・別オリジン** — `SameSite` と Fetch Metadata はどちらも「同一サイト」を通すため、
   同じ登録ドメイン配下に別ホストが増えると、そこからは CSRF が成立する。
   クッキー名に `__Host-` を付けていないため Cookie tossing も残る（`Secure` 必須で開発の http と両立しないため採用していない）
5. **`Sec-Fetch-Site` 非対応ブラウザでのトップレベル GET 遷移** — Safari 16.3 以下 / Firefox 89 以下は
   このヘッダを送らないため、クロスサイトのトップレベル GET 遷移は止まらない
   （`Origin` が付かない経路のため `Origin` 検査では代替できない）。
   被害の上限は各エンドポイントのレート制限で抑えている
6. **ログアウトの取り消し不能性** — `POST /api/auth/logout` が失敗した場合、
   フロントは非 httpOnly のヒントだけ消せるが `nokoroa_token` は消せない。
   失効リストが無いため、そのクッキーは有効期限まで有効

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
   - 自動テスト: `nokoroa-backend/test/auth.e2e-spec.ts`（クッキー属性 / クロスサイト拒否 / OAuth state）、
     `src/auth/auth-cookie.spec.ts`、`nokoroa-frontend/src/providers/__tests__/AuthProvider.test.tsx`

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
1. ~~httpOnly クッキーへの移行~~ ✅ 完了
2. ~~CSRF 対策~~ ✅ `SameSite=Lax` + Fetch Metadata + OAuth state で対応済み
   （CSRF トークン方式は、フロントと API が同一サイトである限り不要と判断）
3. トークンリフレッシュ機能 / 失効リスト — 未実装
4. signup のメールアドレス確認 — 未実装（上記「残っているリスク」2）

### 中優先度
1. セッション管理の改善（API が 401 を返したときにクライアント側の認証状態を落とす経路）
2. ~~レート制限の実装~~ ✅ `ThrottlerModule`（IP 単位）+ `UserThrottlerGuard`（ユーザー単位）
3. ~~セキュリティヘッダーの設定~~ ✅ `helmet()`（`nokoroa-backend/src/main.ts`）

### 低優先度
1. 詳細な監査ログ
2. 異常検出システム
3. セキュリティダッシュボード

## 認証の移行（完了）

localStorage ベースから httpOnly クッキーへの移行は完了している。実装の所在:

| 関心 | 場所 |
| --- | --- |
| クッキーの名前・属性・発行・削除 | `nokoroa-backend/src/auth/auth-cookie.ts` |
| JWT の取り出し（クッキー優先 → Bearer） | `nokoroa-backend/src/auth/jwt.strategy.ts` |
| セッション確認 / ログアウト | `nokoroa-backend/src/auth/auth.controller.ts`（`GET /auth/me` / `POST /auth/logout`） |
| クロスサイト拒否 | `nokoroa-backend/src/common/fetch-metadata.guard.ts` / `nokoroa-backend/src/common/allow-cross-site-navigation.decorator.ts` |
| OAuth の state 検証 | `nokoroa-backend/src/auth/oauth-state.store.ts` |
| フロントの認証状態 | `nokoroa-frontend/src/providers/AuthProvider.tsx` |
| 自社 API への fetch 設定 | `nokoroa-frontend/src/lib/apiConfig.ts`（`API_FETCH_OPTIONS`） |

`Authorization: Bearer` も引き続き受け付ける（Swagger と E2E 用）。
クッキーがある場合はクッキーが優先されるため、Swagger で別ユーザーを試すときはクッキーを消すこと。