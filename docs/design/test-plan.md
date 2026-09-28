# テスト計画書

## 1. テスト概要

### 1.1 目的
本プロジェクトの品質を担保するため、各種テストを実施する。

### 1.2 テスト範囲

| 対象 | テスト種別 | ツール |
|------|-----------|-------|
| バックエンドAPI | ユニットテスト、E2Eテスト | Jest / Jest + Supertest |
| フロントエンド | ユニットテスト（`utils` / `lib` の純ロジックのみ） | Vitest |
| AIサービス | ユニットテスト | pytest |
| インフラ (Terraform) | 静的検証（`fmt -check` / `init -backend=false` / `validate`） | Terraform CLI |

いずれも `.github/workflows/ci.yml` が PR と main への push で実行します。
インフラは `plan` / `apply` を CI で回しておらず（認証情報が必要なため）、適用時にしか
現れない問題は手動確認に委ねています。

---

## 2. テスト環境

| 環境 | 用途 |
|------|------|
| ローカル | 開発中のテスト実行 |
| CI (GitHub Actions) | PR時の自動テスト |

---

## 3. テスト種別

### 3.1 バックエンドのユニットテスト

**対象**: Service 層と共通処理（`src/**/*.spec.ts`。auth / users / posts / follows / favorites / chat / embeddings の各 service に加え、`common` 配下の environment・image-upload・pagination.dto・s3.service・user-throttler.guard）

**ツール**: Jest（`nokoroa-backend`）

**実行コマンド**:
```bash
cd nokoroa-backend
npm run test          # ユニット
npm run test:cov      # カバレッジ計測（閾値は未設定。数値の確認用）
```

---

### 3.2 E2Eテスト

**対象**: APIエンドポイント（`test/*.e2e-spec.ts`。auth / posts / follows / favorites / embeddings / throttle）

**ツール**: Jest + Supertest

**実行コマンド**:
```bash
cd nokoroa-backend
npm run test:e2e
```

実 DB を使うため、CI では pgvector 同梱の PostgreSQL をサービスコンテナとして起動し、
`prisma migrate deploy` を流してから実行しています。ローカルでは `docker compose` の
DB を向けてください。

---

### 3.3 フロントエンドのユニットテスト

**対象**: `src/utils` と `src/lib` の純ロジック（auth・dateFormat・ime・tagColors・apiConfig）。
`vitest.config.ts` の `environment: 'node'` が示すとおり、**コンポーネントの描画テストは対象外**です。

**ツール**: Vitest（`nokoroa-frontend`）

**実行コマンド**:
```bash
cd nokoroa-frontend
npm run test          # vitest run
npm run test:watch
```

---

### 3.4 AIサービスのユニットテスト

**対象**: `nokoroa-ai/tests`（auth・chat・embeddings・schemas）

**ツール**: pytest

**実行コマンド**:
```bash
cd nokoroa-ai
pytest -q
```

---

### 3.5 カバレッジの扱い

**数値目標は設定していません。** バックエンドの Jest・フロントエンドの Vitest・
AI の pytest のいずれにも閾値（`coverageThreshold` 等）を入れておらず、
CI がカバレッジ不足でビルドを落とすことはありません。「80% 以上」といった数字を
掲げても計測・強制する仕組みが無く、実態と乖離するだけのためです。

方針としては、**分岐のあるロジック（認証・権限判定・入力検証・整形処理）に
テストを置き、フレームワークの配線コードは対象にしない**という置き方で運用しています。
将来的に閾値を導入する場合は、まず `npm run test:cov` で現在値を測ってから
下回らない水準で設定します（「今後の改善点」参照）。

---

## 4. テストケース

以下はバックエンド API に対して担保したい観点の一覧です。**実装済みのテスト関数名との
1 対 1 の対応表ではありません**（ID は本文書内での参照用）。実際に何が通っているかは
`npm run test` / `npm run test:e2e` の出力を見てください。

### 4.1 認証 (auth)

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| AUTH-001 | 正しい認証情報でログイン | JWTトークンが返却される |
| AUTH-002 | 不正なパスワードでログイン | 401エラーが返却される |
| AUTH-003 | 存在しないメールでログイン | 401エラーが返却される |
| AUTH-004 | パスワードなしでログイン | 400エラーが返却される |
| AUTH-005 | Google認証コールバック | ユーザー作成/ログイン成功 |

---

### 4.2 ユーザー (users)

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| USER-001 | 正しい情報で新規登録 | ユーザーが作成される |
| USER-002 | 重複メールで新規登録 | 409エラーが返却される |
| USER-003 | 不正なメール形式で登録 | 400エラーが返却される |
| USER-004 | 短すぎるパスワードで登録 | 400エラーが返却される |
| USER-005 | ユーザー情報取得 | ユーザー情報が返却される |
| USER-006 | 存在しないユーザー取得 | 404エラーが返却される |
| USER-007 | プロフィール更新 | 更新されたユーザー情報が返却される |
| USER-008 | 未認証でプロフィール更新 | 401エラーが返却される |

---

### 4.3 投稿 (posts)

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| POST-001 | 投稿一覧取得 | 公開投稿の一覧が返却される |
| POST-002 | 投稿詳細取得 | 投稿詳細が返却される |
| POST-003 | 存在しない投稿取得 | 404エラーが返却される |
| POST-004 | 認証済みで投稿作成 | 投稿が作成される |
| POST-005 | 未認証で投稿作成 | 401エラーが返却される |
| POST-006 | タイトルなしで投稿作成 | 400エラーが返却される |
| POST-007 | 投稿者本人が投稿編集 | 投稿が更新される |
| POST-008 | 他人の投稿を編集 | 403エラーが返却される |
| POST-009 | 投稿者本人が投稿削除 | 投稿が削除される |
| POST-010 | 他人の投稿を削除 | 403エラーが返却される |
| POST-011 | キーワードで検索 | 該当投稿が返却される |
| POST-012 | タグで検索 | 該当投稿が返却される |
| POST-013 | タグ付きで投稿作成 | 投稿とタグが作成される |
| POST-014 | 位置情報付きで投稿作成 | 投稿と位置情報が作成される |

---

### 4.4 フォロー (follows)

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| FOLLOW-001 | ユーザーをフォロー | フォロー関係が作成される |
| FOLLOW-002 | 自分自身をフォロー | 400エラーが返却される |
| FOLLOW-003 | 既にフォロー済みのユーザーをフォロー | 409エラーが返却される |
| FOLLOW-004 | フォロー解除 | フォロー関係が削除される |
| FOLLOW-005 | フォローしていないユーザーを解除 | 404エラーが返却される |
| FOLLOW-006 | フォロワー一覧取得 | フォロワーリストが返却される |
| FOLLOW-007 | フォロー中一覧取得 | フォロー中リストが返却される |
| FOLLOW-008 | フォロー状態確認 | isFollowing が返却される |

---

### 4.5 ブックマーク (favorites)

| ID | テストケース | 期待結果 |
|----|-------------|----------|
| FAV-001 | 投稿をブックマーク | ブックマークが作成される |
| FAV-002 | 既にブックマーク済みの投稿をブックマーク | 409エラーが返却される |
| FAV-003 | ブックマーク解除 | ブックマークが削除される |
| FAV-004 | ブックマークしていない投稿を解除 | 404エラーが返却される |
| FAV-005 | ブックマーク一覧取得 | ブックマークリストが返却される |
| FAV-006 | 未認証でブックマーク | 401エラーが返却される |

---

## 5. テスト実行結果

**結果の正は GitHub Actions です。** この文書に実行結果の表を持つと更新が止まった
時点で嘘になるため、件数・成否は CI の実行ログを参照してください
（`.github/workflows/ci.yml` の frontend / backend / ai / terraform の各ジョブ）。

規模の目安（更新時点）:

| 対象 | テストファイル数 | 備考 |
|------|---------------:|------|
| バックエンド ユニット | 13 | `src/**/*.spec.ts` |
| バックエンド E2E | 6 | `test/*.e2e-spec.ts`。実 DB 必須 |
| フロントエンド ユニット | 5 | 計 66 ケース（`vitest run`） |
| AIサービス | 4 | `pytest` |

---

## 6. CI/CD統合

### 6.1 GitHub Actions

`ci.yml` は PR（`main` 宛）と `main` への push の両方で走ります。ジョブは 4 つです。

| ジョブ | 内容 |
|-------|------|
| `frontend` | `npm ci` → lint → `vitest run` → typecheck → build |
| `backend` | `npm ci` → `prisma generate` → lint → Jest → `prisma migrate deploy` → pgvector HNSW インデックスの実在確認 → E2E → build |
| `ai` | `ruff check` / `ruff format --check` → `pytest -q` → ARM64 での Docker ビルド（push はしない） |
| `terraform` | `fmt -check -recursive` → `init -backend=false -lockfile=readonly` → `validate` |

`backend` ジョブの「HNSW インデックスの実在確認」は、`prisma migrate diff` が
pgvector のインデックスを毎回 DROP しようとするため入れています。取り込んでしまうと
エラーを出さないまま類似度検索が全件走査に落ちるので、マイグレーション適用後に
存在を検査しています。

### 6.2 テスト失敗時の対応

1. CIが失敗した場合、PRはマージ不可
2. テスト失敗の原因を調査・修正
3. 修正後、再度PRを作成

---

## 7. 今後の改善点

| 項目 | 内容 |
|------|------|
| フロントエンドのコンポーネントテスト | 現在は `utils` / `lib` の純ロジックのみ。描画・イベントを見るなら jsdom + React Testing Library の追加が必要 |
| カバレッジの可視化と閾値 | まず `npm run test:cov` で現在値を測り、下回らない水準で `coverageThreshold` を設定する。可視化は codecov 等 |
| パフォーマンステスト | 負荷テストツール導入 |
| セキュリティテスト | OWASP ZAP等でスキャン |
| インフラの `plan` 検証 | 現在の CI は `validate` 止まり。OIDC で読み取り専用ロールを引ければ `plan` まで回せる |
