---
name: nokoroa-dev
description: "Nokoroa開発コマンド集+品質チェック（Docker起動、Prismaマイグレーション、DB操作、ログ確認、lint・type-check・build）。Use when: (1) マイグレーションを実行したい、(2) DBを操作したい、(3) ログを確認したい、(4) タスク完了時の品質チェック、(5) Git pushする前、(6) ユーザーが「品質チェックして」「lintして」「ビルドして」「開発コマンドは？」と指示した場合"
---

# Nokoroa 開発コマンド集

## プロジェクト固有の制約

- **buildしない**（指示があるまで）
- **DB・マイグレーションをリセットしない**
- **既存のログは絶対に消さない**（実装時に追加したデバッグログのみ削除対象）
- **リモートからpullしない**
- **コミット禁止**（ユーザー指示があるまで）

---

## 品質チェック

**コード変更を伴うタスク完了時は、変更を検知したリポジトリに対して自動実行する。**

タスク完了 = 「コード変更が完了した時点」と「ユーザーへ完了報告する直前」の2回。
Push前にも必ず実行する。

エラーが検出された場合は、下記の修正ループで対応する（解消してからタスク完了とする）。

### 修正ループ（lint / type-check / test 失敗時）

```
失敗 → エラー出力読む → 原因特定 → 修正 → 再実行
    ↓（同一原因で3回失敗）
ユーザーへ報告（残エラー・試行差分・原因仮説・推奨アクション）
```

> **握り潰し禁止:** `any` 多用、`eslint-disable` 乱用、`test.skip` でテスト回避をしない。
> どうしても通せない場合はユーザーへ報告して判断を仰ぐ。

### 変更検知と実行

```bash
# 変更があるリポジトリを特定
git diff --name-only HEAD

# nokoroa-backend/ 配下に変更がある場合
cd nokoroa-backend && npm run lint && npm run test

# nokoroa-frontend/ 配下に変更がある場合
cd nokoroa-frontend && npm run lint
```

### 自動修正

```bash
# Backend lint自動修正
cd nokoroa-backend && npm run lint -- --fix

# Frontend lint自動修正
cd nokoroa-frontend && npm run lint -- --fix
```

### Git Push前

Git Push前は上記の品質チェックを実行すること。

---

## Prismaマイグレーション

### スキーマ変更後のマイグレーション生成・実行

```bash
cd nokoroa-backend

# 1. Prismaクライアント再生成
npx prisma generate

# 2. マイグレーション生成（開発環境）
npx prisma migrate dev --name <マイグレーション名>

# 3. Prisma Studioでデータ確認
npx prisma studio
```

### 本番マイグレーション

```bash
npx prisma migrate deploy
```

---

## DB操作

### シードデータ投入

```bash
cd nokoroa-backend && npm run seed
```

---

## サービス起動・停止

### ローカル開発

```bash
# Docker（PostgreSQL + Backend）起動
cd nokoroa-backend && docker-compose up -d

# フロントエンド起動
cd nokoroa-frontend && npm run dev

# Docker停止
cd nokoroa-backend && docker-compose down
```

### 個別起動（Dockerなし）

```bash
# Backend
cd nokoroa-backend && npm run start:dev

# Frontend
cd nokoroa-frontend && npm run dev
```

---

## ログ確認

```bash
# Dockerログ
cd nokoroa-backend && docker-compose logs -f

# 特定サービス
docker-compose logs -f backend
docker-compose logs -f postgres

# 本番ログ（ECS）
aws logs tail "/ecs/nokoroa-prod/backend" --follow --region ap-northeast-1
aws logs tail "/ecs/nokoroa-prod/frontend" --follow --region ap-northeast-1
```

---

## テスト

```bash
# Backend単体テスト
cd nokoroa-backend && npm run test

# Backend E2Eテスト
cd nokoroa-backend && npm run test:e2e

# テストカバレッジ
cd nokoroa-backend && npm run test:cov
```

> **テスト失敗時も上記の修正ループを適用。** `test.skip` / 削除でpassさせるのは禁止。
