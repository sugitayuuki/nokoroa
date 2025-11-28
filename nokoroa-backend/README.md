# Nokoroa Backend

## 環境構築

### 必要なもの

- Node.js
- Docker
- Docker Compose

### セットアップ

1. リポジトリをクローン

```bash
git clone [repository-url]
cd tabi-memory-backend
```

2. 依存関係のインストール

```bash
# コンテナ内で依存関係をインストール
docker compose exec backend npm install
```

3. データベースの起動

```bash
docker-compose up -d
```

4. Prismaのマイグレーション

```bash
# コンテナ内でマイグレーションを実行
docker compose exec backend npx prisma migrate dev --name init

# または、開発環境でマイグレーション履歴を残さない場合
docker compose exec backend npx prisma db push
```

5. アプリケーションの起動

```bash
# 開発モード（Docker Composeで自動的に起動）
docker compose up

# バックグラウンドで実行する場合
docker compose up -d
```

## 開発コマンド

```bash
# 開発サーバーの起動
docker compose up

# ビルド
docker compose exec backend npm run build

# リント
docker compose exec backend npm run lint

# テスト
docker compose exec backend npm run test
```

## Prismaコマンド

```bash
# マイグレーションファイルの作成
docker compose exec backend npx prisma migrate dev --name <migration-name>

# データベースの同期（開発環境）
docker compose exec backend npx prisma db push

# Prismaクライアントの生成
docker compose exec backend npx prisma generate

# Prisma Studioの起動（データベースのGUIツール）
docker compose exec backend npx prisma studio

# マイグレーションのリセット
docker compose exec backend npx prisma migrate reset

# マイグレーションの状態確認
docker compose exec backend npx prisma migrate status
```

## APIエンドポイント

### ユーザー関連

- `POST /users/signup` - ユーザー登録
