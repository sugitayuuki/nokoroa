# Nokoroa - 旅の思い出共有プラットフォーム

## 📱 アプリケーション概要

Nokoroaは、旅行の思い出を写真と共に共有できるソーシャルプラットフォームです。
ユーザーは旅先での体験を投稿し、地図上で視覚的に探索できます。
日本国内の観光地や隠れた名所を発見し、他のユーザーと旅の感動を共有することができます。

### 🎯 主な機能

- **投稿機能**: 写真、タイトル、説明文、位置情報、タグを含む旅行体験の投稿
- **地図検索**: Google Maps APIを活用した位置情報ベースの投稿検索
- **ブックマーク機能**: お気に入りの投稿を保存して後で見返せる
- **ユーザープロフィール**: アバター画像、自己紹介、投稿履歴の管理
- **リアルタイム検索**: タグ、キーワード、場所による高度な検索機能
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ全デバイス対応

## 🛠 技術スタック

### フロントエンド
- **Framework**: Next.js 15.3.1 (App Router)
- **Language**: TypeScript 5
- **UI Library**: Material-UI (MUI) v7
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: SWR (データフェッチング)
- **Form Handling**: React Hook Form + Zod (バリデーション)
- **Map Integration**: Google Maps JavaScript API
- **Authentication**: JWT (JSON Web Tokens)

### バックエンド
- **Framework**: NestJS 10
- **Language**: TypeScript 5
- **Database**: PostgreSQL
- **ORM**: Prisma 6
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer
- **API**: RESTful API

### インフラ・開発環境
- **Package Manager**: npm
- **Linter**: ESLint
- **Formatter**: Prettier
- **Version Control**: Git
- **Container**: Docker (開発環境用PostgreSQL)

## 🚀 実装のポイント

### 1. パフォーマンス最適化
- **Next.js App Router**による効率的なルーティングとSSR/SSG
- **SWR**を使用した効率的なデータフェッチングとキャッシング
- **無限スクロール**実装による大量データの効率的な表示
- **画像の遅延読み込み**によるページロード速度の改善

### 2. ユーザビリティ
- **直感的なUI/UX**: Material-UIを活用した統一感のあるデザイン
- **リアルタイム検索**: デバウンス処理を実装した快適な検索体験
- **位置情報連携**: ブラウザのGeolocation APIとIPベースの位置情報取得
- **エラーハンドリング**: ユーザーフレンドリーなエラーメッセージとフォールバック

### 3. セキュリティ
- **JWT認証**: セキュアなトークンベース認証
- **入力値検証**: Zodによるスキーマベースのバリデーション
- **XSS対策**: Reactの自動エスケープとサニタイズ処理
- **環境変数管理**: 機密情報の適切な管理

### 4. コード品質
- **TypeScript**: 型安全性による堅牢なコード
- **ESLint/Prettier**: 一貫性のあるコードスタイル
- **コンポーネント設計**: 再利用可能なコンポーネント構造
- **カスタムフック**: ロジックの分離と再利用性の向上

## 📊 データベース設計

### 主要テーブル
- **User**: ユーザー情報（名前、メール、パスワード、プロフィール）
- **Post**: 投稿情報（タイトル、内容、画像、位置情報、タグ）
- **Bookmark**: ユーザーと投稿の多対多リレーション

## 🎨 UI/UXの工夫

1. **マテリアルデザイン準拠**: Googleのデザインガイドラインに基づいた統一感のあるUI
2. **ダークモード対応**: ユーザーの好みに応じたテーマ切り替え
3. **スムーズなナビゲーション**: ページ遷移時のローディング表示とアニメーション
4. **アクセシビリティ**: ARIA属性の適切な使用とキーボード操作対応

## 💡 開発で工夫した点

1. **カスタムフックの活用**
   - `useInfiniteScroll`: 無限スクロールロジックの抽象化
   - `usePosts`, `useUser`: データフェッチングロジックの共通化
   - `useSmoothNavigation`: ナビゲーション処理の統一

2. **エラーバウンダリーの実装**
   - 予期しないエラーに対する適切なフォールバックUI

3. **最適化されたビルド設定**
   - コード分割による初期ロード時間の短縮
   - 静的生成とサーバーサイドレンダリングの使い分け

## 📈 今後の改善予定

- [ ] PWA対応（オフライン機能）
- [ ] 通知機能の実装
- [ ] ソーシャル機能の拡充（フォロー、いいね、コメント）
- [ ] AIを活用した投稿レコメンデーション
- [ ] 多言語対応（i18n）

## 🏃‍♂️ セットアップ方法

```bash
# リポジトリのクローン
git clone [repository-url]
cd nokoroa-frontend

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.localを編集してAPIエンドポイントとGoogle Maps APIキーを設定

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プロダクションモードで起動
npm start
```

## 📝 環境変数

```env
NEXT_PUBLIC_API_URL=http://localhost:4000  # バックエンドAPIのURL
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key  # Google Maps APIキー
```

## 🧪 テストコマンド

```bash
# TypeScriptの型チェック
npm run type-check

# ESLintによるコード品質チェック
npm run lint

# Prettierによるコードフォーマット
npm run format
```

## 📚 プロジェクト構造

```
src/
├── app/                # Next.js App Router
│   ├── layout.tsx      # ルートレイアウト
│   ├── page.tsx        # ホームページ
│   ├── posts/          # 投稿関連ページ
│   ├── profile/        # プロフィール関連ページ
│   └── ...
├── components/         # 再利用可能なコンポーネント
│   ├── layout/         # レイアウトコンポーネント
│   ├── post/           # 投稿関連コンポーネント
│   ├── auth/           # 認証関連コンポーネント
│   └── ...
├── hooks/              # カスタムフック
├── lib/                # ユーティリティ関数
├── providers/          # Context Providers
├── types/              # TypeScript型定義
└── utils/              # ヘルパー関数
```

## 👥 開発者

- 開発期間: 2024年5月〜現在
- 役割: フルスタック開発（フロントエンド中心）
- 使用技術の選定から実装まで一貫して担当

## 📄 ライセンス

MIT License

---

**Note**: このプロジェクトは個人開発のポートフォリオ作品です。
実際のサービス運用を想定した本格的なWebアプリケーションとして開発しました。