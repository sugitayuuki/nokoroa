# Nokoroa

**旅の思い出を、地図の上に残していく。**

行った場所、撮った写真、そのとき感じたこと。ばらばらになりがちな旅の記録を、
ひとつの地図の上にまとめて置いておけるサービスです。

**URL**: https://nokoroa.com

> [!NOTE]
> 現在、コスト削減のため本番環境は停止しています。動きは下の[デモ動画](#デモ動画)でご覧いただけます。
> ローカルでも [数コマンドで起動できます](#ローカルで動かす)。

![Nokoroa Screenshot](https://github.com/sugitayuuki/nokoroa/releases/download/assets/screencapture-localhost-3000-2025-11-26-02_41_56.png)

## なぜ作ったのか

旅行が好きで、帰ってきたあとに写真を見返す時間もわりと好きです。
でもその「見返す」がいつも少し面倒でした。

Instagram に上げた写真は日常の投稿に埋もれてしまうし、カメラロールは日付順に並ぶだけ。
「3年前のあの街、何を食べたんだっけ」を思い出そうとすると、結局スクロールの旅が始まります。
旅行特化のアプリもいくつか試してみたのですが、しっくりくるものに出会えませんでした。

ないなら作ろう！ ということで作ったのが Nokoroa です。
**時系列ではなく場所から辿れること**を中心に据えて、地図・タグ・AI検索を組み立てています。

## できること

旅の記録を投稿して、あとからいろいろな入り口で探し出せます。

| できること | 中身 |
| --- | --- |
| **投稿する** | 写真・位置情報・タグをまとめて1つの思い出として記録 |
| **地図から探す** | Google Maps 上にピンが並び、訪れた場所から辿れる |
| **AI に聞いて探す** | 「海がきれいだった場所」のような曖昧な言葉でも見つかる |
| **とっておく** | 気になった投稿をブックマーク |
| **つながる** | フォロー / フォロワー、プロフィール管理 |
| **ログイン** | メール + パスワード、または Google アカウント |

### AIチャット（RAG）

「あの時の、海がきれいだったところ」——タグにも本文にも書いていない曖昧な言葉で探せるように、
RAG を実装しました。

投稿本文を Gemini で埋め込みベクトルに変換して pgvector に保存し、質問に近い投稿をベクトル検索で取り出して、
文脈として Gemini に渡します。返答は SSE でストリーミングされるので、待ち時間が「無言の数秒」になりません。

![Image](https://github.com/user-attachments/assets/caa08bd7-da73-4388-b8d2-4e2108cda0a7)

## デモ動画

https://github.com/user-attachments/assets/f07d74f1-8a48-466a-92bb-30d0cdebf994

## 触ってみる

ログインからやると手間だと思うので、そのまま使えるアカウントを用意しました。どうぞご自由に！

| メールアドレス | パスワード |
|---------------|-----------|
| `michael@example.com` | `password123` |
| `james@example.com` | `password123` |
| `pierre@example.com` | `password123` |
| `david@example.com` | `password123` |
| `alex@example.com` | `password123` |

## 技術選定 — 何を考えて選んだか

「流行っているから」だけで選ばないようにしました。
それぞれ、こう考えて決めています。

### バックエンド: NestJS

前職で書いていたので、**手が覚えている**のが一番大きい理由です。
個人開発で学習コストを2つ同時に払うと、だいたいどちらも中途半端になります。

加えて、フロントの Next.js と TypeScript で揃えられること、
想定していた規模（中規模）に対して NestJS のモジュール構造がちょうど良かったことが決め手でした。

### ORM: Prisma

スキーマファイルが1つあれば、そこからマイグレーションも型も生成されるのが気持ちよかったからです。
DB アクセスのミスがコンパイル時に落ちるので、実行して初めて気づくことがだいぶ減りました。
ドキュメントが丁寧で詰まりにくいのも、1人で書く上では効いています。

### フロントエンド: Next.js (App Router)

こちらも前職での経験が土台です。React エコシステムの層の厚さは1人開発だと素直に助かります。

App Router を選んだのは、React Server Components を実際に触ってみたかったからです。
ただし**この判断には反省点もあります** — 認証トークンを localStorage に置いた結果、
サーバー側でトークンを読めず、ほとんどのページが Client Component になりました。
Cookie 認証に移せば段階的に RSC 化できる、というのが現時点の整理です。

### 認証: JWT + Google OAuth

ライブラリに丸投げすれば早かったのですが、**認証は仕組みを理解しておきたかった**ので自前で実装しました。
おかげでトークンの寿命や失効の難しさを、身をもって理解することになりました。

Google OAuth は、パスワードを覚えてもらう前提のサービスにしたくなかったので追加しています。

### インフラ: AWS ECS Fargate + Terraform

実務で使われる構成を、自分の手で最初から組んでみたかったからです。
Terraform でコード化しておけば「あの設定どこで変えたっけ」が起きず、環境ごと作り直せます。
Fargate はサーバーの面倒を見なくていい分、アプリ側に時間を使えました。

### CI / CD: GitHub Actions

リポジトリと同じ場所で完結するのが一番の理由です。
パブリックリポジトリなら無料枠が大きいのも、個人開発では現実的に効きます。

## ローカルで動かす

手元で動かせるところまで、なるべく短い手順にしました。4ステップです！

### 用意するもの

- Docker / Docker Compose
- Node.js 22 以上（フロントエンドをホストで動かす場合）
- Gemini API キー — **AIチャットを使う場合のみ**。無くても投稿・地図・検索はふつうに動きます

### 手順

```bash
git clone https://github.com/sugitayuuki/nokoroa.git
cd nokoroa

# 1. バックエンド + DB + AI サービスの環境変数を用意
#    .env.example には NODE_ENV=development が入っています。
#    未設定だと本番相当とみなされ FRONTEND_URL / AWS_BUCKET_NAME が必須になります。
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

お疲れさまでした、ここまでで一通り動きます！ AIチャットで既存の投稿もヒットさせたい場合は、
`nokoroa-backend` 配下で `npm run backfill:embeddings` を実行して埋め込みを作ってください。

<details>
<summary><b>運用するときに踏みやすい落とし穴（3つ）</b></summary>

実際に自分が踏んだ・踏みかけたものです。同じ思いをする人が出ないように残しておきます！

**1. 埋め込みモデルを変えたら、必ず全件やり直す**

> [!WARNING]
> モデルが違うとベクトル空間そのものが違うので、新旧が混ざると**検索結果が静かに壊れます**。
> エラーは出ません。ただ「なんか検索がバカになった」という形で表に出ます。

```bash
cd nokoroa-backend && npm run backfill:embeddings -- --all
```

**2. スキーマ変更を含むデプロイは、先にマイグレーション**

アプリを入れ替える前に `npx prisma migrate deploy` を実行してください。
現状これは**デプロイワークフローに入っていません**（認識していて、まだ直せていない箇所です）。

**3. 非公開にした投稿の埋め込みは、自動では消えない**

過去分をまとめて消すには下記を。`-- --dry-run` を付けると件数だけ確認できます。

```bash
npm run purge:private-embeddings
```

</details>

## 使用技術一覧

ひと目で分かるように表にまとめました！

| 分類 | 使用技術 |
| --- | --- |
| **バックエンド** | Node.js 22 / NestJS 11 / TypeScript 5 / Prisma 6 / PostgreSQL |
| **フロントエンド** | TypeScript 5 / React 19 / Next.js 15 (App Router) / Material-UI v7 |
| **主要パッケージ** | SWR / React Hook Form / Zod / react-hot-toast / date-fns |
| **AI / RAG** | Python 3.12 / FastAPI / Google Gemini（チャット + 埋め込み）/ pgvector (HNSW) |
| **インフラ** | AWS（Route53 / ACM / ALB / VPC / ECR / ECS Fargate / RDS PostgreSQL / S3 / CloudWatch） |
| **IaC / 環境構築** | Terraform / Docker / Docker Compose |
| **CI / CD** | GitHub Actions |
| **認証** | JWT / Google OAuth 2.0 |
| **外部API** | Google Maps JavaScript API |
| **テスト** | Jest / SuperTest（ユニット + E2E） |
| **静的解析** | ESLint / Prettier（フロント・バックとも） |

## ER図

`Post` を中心に、場所（`Location`）・タグ（`Tag`）・埋め込み（`PostEmbedding`）がぶら下がる形です。

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

バックエンド / AI / フロントエンド / インフラの4つに分かれています。長いので折りたたんでいます。

<details>
<summary><b>全体を見る</b></summary>

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

</details>

## インフラ構成図

ALB の後ろに ECS Fargate、その中に backend と AI サービスを同居させています。
AI サービスは外部に出さず、localhost 経由でのみ呼べる構成です。

![Infrastructure](https://github.com/sugitayuuki/nokoroa/releases/download/assets/messageImage_1764334338555.jpg)

---

ここまで読んでいただき、ありがとうございました！
気になった点があれば、[Issue](https://github.com/sugitayuuki/nokoroa/issues) からお気軽にどうぞ。
