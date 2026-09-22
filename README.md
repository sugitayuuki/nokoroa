# Nokoroa

旅の思い出を共有するソーシャルプラットフォーム

**URL**: https://nokoroa.com

> **Note**: 現在、コスト削減のため本番環境の稼働を停止しています。動作確認はデモ動画をご覧ください。

![Nokoroa Screenshot](https://github.com/sugitayuuki/nokoroa/releases/download/assets/screencapture-localhost-3000-2025-11-26-02_41_56.png)


### AIチャット（RAG）

投稿本文を Gemini で埋め込み、pgvector に保存。質問に近い投稿をベクトル検索で取り出し、
文脈として Gemini に渡して SSE でストリーミング応答します。

![Image](https://github.com/user-attachments/assets/caa08bd7-da73-4388-b8d2-4e2108cda0a7)

## デモ動画

https://github.com/user-attachments/assets/f07d74f1-8a48-466a-92bb-30d0cdebf994

## 概要

Nokoroaは、旅行の思い出を写真と共に共有できるWebアプリケーションです。ユーザーは旅先での体験を投稿し、地図上で視覚的に探索できます。

### 主な機能

- 写真・位置情報・タグ付きの旅行体験投稿
- Google Mapsを活用した地図検索
- ブックマーク機能
- フォロー/フォロワー機能
- ユーザープロフィール管理
- Google OAuth認証

## テストユーザー

以下のアカウントでログインできます。

| メールアドレス | パスワード |
|---------------|-----------|
| `michael@example.com` | `password123` |
| `james@example.com` | `password123` |
| `pierre@example.com` | `password123` |
| `david@example.com` | `password123` |
| `alex@example.com` | `password123` |

## 開発背景

旅行が好きで、旅先での思い出を共有することに特化したサービスがあれば便利だと感じたのがきっかけです。

Instagramなどの既存SNSでは、投稿形式が限定されていたり、旅行以外の様々な投稿が混在してしまい、旅行体験だけを振り返ったり探したりするのが難しいと感じていました。また、旅行に特化した既存アプリを探してみましたが、満足できるものが見つかりませんでした。

そこで、旅行の思い出共有に特化し、地図から投稿を探せるなど旅行体験に最適化されたプラットフォームを自分で作ることにしました。

## 技術選定理由

各技術を採用した理由を記載しております。

### バックエンド: NestJS

**採用理由**:
- 前職で使用しており、実務経験があったため
- フロントエンドのNext.jsと同じTypeScriptで統一できるため
- 中規模サービスを想定しており、NestJSのモジュール構造がちょうど良いと判断したため

### ORM: Prisma

**採用理由**:
- スキーマ駆動開発ができ、マイグレーション管理が直感的なため
- 生成される型が厳密で、コンパイル時にDBアクセスのエラーを検出できるため
- ドキュメントが充実しており、学習しやすかったため

### インフラ: AWS ECS Fargate + Terraform

**採用理由**:
- 実務で使われるインフラ構成を経験したかったため
- Terraformでインフラをコード管理することで、環境の再現性を担保できるため
- Fargateを選択することで、サーバー管理の負担を減らしつつ本番運用レベルの構成を実現できるため

### 認証: JWT + Google OAuth

**採用理由**:
- 認証の仕組みを理解するため、自前でJWT認証を実装したかったため
- 外部サービスに依存せず、認証フロー全体をコントロールできるため
- Google OAuthはユーザーの利便性向上のために追加したため

### CI / CD: GitHub Actions

**採用理由**:
- GitHubとの統合がシームレスで、設定が直感的なため
- パブリックリポジトリであれば無料枠が大きいため

### フロントエンド: Next.js (App Router)

**採用理由**:
- 前職で使用しており、実務経験があったため
- Reactエコシステムが充実しており、情報量が多いため
- App Routerを使うことで、最新のReact Server Componentsを活用できるため
- React/Next.jsが世界的なトレンドだったため

## ローカルでの起動

### 前提

- Docker / Docker Compose
- Node.js 22 以上（フロントエンドをホストで動かす場合）
- Gemini API キー（AIチャットを使う場合のみ。無くても他の機能は動きます）

### 手順

```bash
git clone https://github.com/sugitayuuki/nokoroa.git
cd nokoroa

# 1. バックエンド + DB + AI サービスの環境変数を用意
cd nokoroa-backend
cp .env.example .env
export JWT_SECRET=$(openssl rand -base64 32)   # 32文字未満だと起動しません
export INTERNAL_AI_TOKEN=$(openssl rand -hex 16)
export GEMINI_API_KEY=your-gemini-api-key      # AIチャットを使う場合

# 2. 起動（PostgreSQL は pgvector 同梱イメージを使います）
docker compose up -d

# 3. マイグレーション適用
docker compose exec backend npx prisma migrate deploy

# 4. フロントエンド
cd ../nokoroa-frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL などを設定
npm ci
npm run dev
```

| サービス | URL |
| --- | --- |
| フロントエンド | http://localhost:3000 |
| バックエンド | http://localhost:4000 |
| API ドキュメント (Swagger) | http://localhost:4000/api/docs |
| AI サービス | http://localhost:8000 |

既存の投稿に埋め込みを作るには `npm run backfill:embeddings`（`nokoroa-backend` 配下）を実行します。

### 運用上の注意

- **埋め込みモデル（`EMBEDDING_MODEL`）を変更した場合は、必ず全件の再埋め込みが必要です。**
  モデルごとにベクトル空間が異なるため、新旧のベクトルが混在すると類似度検索の結果が壊れます。
  ```bash
  cd nokoroa-backend && npm run backfill:embeddings -- --all
  ```
- スキーマ変更を含むデプロイでは、アプリの入れ替え前に `npx prisma migrate deploy` を実行してください（現状、デプロイワークフローには含まれていません）。
- 非公開投稿の埋め込みを過去分まで削除するには `npm run purge:private-embeddings`（`-- --dry-run` で件数確認）。

## 使用技術一覧

**バックエンド**: Node.js 22 / NestJS 11 / TypeScript 5 / Prisma 6 / PostgreSQL

コード解析 / フォーマッター: ESLint / Prettier

テストフレームワーク: Jest / SuperTest

**フロントエンド**: TypeScript 5 / React 19 / Next.js 15 (App Router)

コード解析 / フォーマッター: ESLint / Prettier

CSSフレームワーク: Material-UI v7

主要パッケージ: SWR / React Hook Form / Zod / react-hot-toast / date-fns

**AI / RAG**: Python 3.12 / FastAPI / Google Gemini (チャット + 埋め込み) / pgvector (HNSW)

**インフラ**: AWS (Route53 / ACM / ALB / VPC / ECR / ECS Fargate / RDS PostgreSQL / S3 / CloudWatch)

CI / CD: GitHub Actions

IaC: Terraform

環境構築: Docker / Docker Compose

**認証**: JWT / Google OAuth 2.0

**外部API**: Google Maps JavaScript API

## ER図

```mermaid
erDiagram
    User ||--o{ Post : "投稿する"
    User ||--o{ Bookmark : "ブックマーク"
    User ||--o{ Follow : "フォローする"
    User ||--o{ Follow : "フォローされる"
    Post ||--o{ Bookmark : "ブックマークされる"
    Post ||--o{ PostTag : "タグ付け"
    Post ||--o| PostEmbedding : "埋め込み"
    Tag ||--o{ PostTag : "投稿に付く"
    Location ||--o{ Post : "場所"

    User {
        int id PK
        string email UK
        string name
        string password
        string bio
        string avatar
        string googleId UK
        string provider
        datetime createdAt
        datetime updatedAt
    }

    Post {
        int id PK
        string title
        string content
        string imageUrl
        boolean isPublic
        int authorId FK
        int locationId FK
        datetime createdAt
        datetime updatedAt
    }

    Tag {
        int id PK
        string name UK
        string slug UK
        datetime createdAt
    }

    PostTag {
        int id PK
        int postId FK
        int tagId FK
        datetime createdAt
    }

    Location {
        int id PK
        string name
        string country
        string prefecture
        float latitude
        float longitude
        datetime createdAt
    }

    PostEmbedding {
        int id PK
        int postId FK_UK
        string contentText
        vector embedding "vector(768) / pgvector"
        datetime createdAt
        datetime updatedAt
    }

    Bookmark {
        int id PK
        int userId FK
        int postId FK
        datetime createdAt
    }

    Follow {
        int id PK
        int followerId FK
        int followingId FK
        datetime createdAt
    }
```

## ディレクトリ構成

```
nokoroa/
├── nokoroa-backend/
│   ├── src/
│   │   ├── auth/                # 認証モジュール (JWT, Google OAuth)
│   │   │   ├── strategies/      # Passport認証戦略
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── jwt-auth.guard.ts
│   │   ├── users/               # ユーザー管理モジュール
│   │   │   ├── dto/             # リクエスト/レスポンスDTO
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── posts/               # 投稿モジュール
│   │   │   ├── dto/             # 投稿関連DTO
│   │   │   ├── posts.controller.ts
│   │   │   └── posts.service.ts
│   │   ├── favorites/           # ブックマークモジュール
│   │   ├── follows/             # フォローモジュール
│   │   ├── chat/                # AIチャット (SSE中継・RAGの検索)
│   │   ├── embeddings/          # 埋め込み生成・ベクトル検索 (pgvector)
│   │   ├── scripts/             # 埋め込みのバックフィル等の運用スクリプト
│   │   ├── prisma/              # Prismaサービス
│   │   └── main.ts              # アプリケーションエントリーポイント
│   ├── prisma/
│   │   ├── schema.prisma        # データベーススキーマ
│   │   ├── migrations/          # マイグレーションファイル
│   │   └── seed.ts              # シードデータ
│   ├── test/                    # E2Eテスト
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── nokoroa-ai/                  # AIサービス (FastAPI + Gemini)
│   ├── app/
│   │   ├── routers/             # chat / embeddings エンドポイント
│   │   ├── services/            # Gemini クライアント
│   │   ├── security.py          # 内部呼び出しのトークン検証
│   │   └── config.py            # モデルID等の設定
│   └── Dockerfile
│
├── nokoroa-frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── posts/           # 投稿ページ
│   │   │   ├── users/           # ユーザーページ
│   │   │   ├── profile/         # プロフィールページ
│   │   │   ├── search/          # 検索ページ
│   │   │   ├── bookmarks/       # ブックマークページ
│   │   │   ├── map/             # 地図ページ
│   │   │   ├── auth/            # 認証コールバック
│   │   │   └── @dialog/         # モーダルダイアログ
│   │   ├── components/          # 共通コンポーネント
│   │   │   ├── post/            # 投稿関連
│   │   │   ├── auth/            # 認証関連
│   │   │   ├── map/             # 地図関連
│   │   │   ├── search/          # 検索関連
│   │   │   └── common/          # 共通UI
│   │   ├── hooks/               # カスタムフック
│   │   ├── providers/           # Contextプロバイダー
│   │   ├── lib/                 # APIクライアント
│   │   ├── types/               # 型定義
│   │   └── utils/               # ユーティリティ
│   ├── public/                  # 静的ファイル
│   └── Dockerfile
│
└── terraform/                   # インフラ構成 (AWS)
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

## インフラ構成図

![Infrastructure](https://github.com/sugitayuuki/nokoroa/releases/download/assets/messageImage_1764334338555.jpg)
