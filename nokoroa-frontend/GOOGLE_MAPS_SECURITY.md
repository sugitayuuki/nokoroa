# Google Maps API セキュリティ設定

## 現在のAPIキー設定の課題

現在のGoogle Maps APIキーはクライアントサイドに露出しているため、以下のセキュリティ設定を強く推奨します。

## 推奨セキュリティ設定

### 1. API制限の設定

Google Cloud Consoleで以下の制限を設定してください：

```
Maps JavaScript API のみ許可
- Maps JavaScript API
- Places API (必要な場合)
```

### 2. HTTPリファラー制限

以下のドメインのみAPIアクセスを許可：

```
開発環境:
localhost:3000/*
127.0.0.1:3000/*

本番環境:
yourdomain.com/*
www.yourdomain.com/*
```

### 3. 使用量制限

予期しない課金を防ぐため、以下の制限を設定：

```
Maps JavaScript API:
- 1日あたり: 25,000リクエスト
- 1分あたり: 100リクエスト
```

## セキュリティチェックリスト

- [ ] API制限を設定済み
- [ ] HTTPリファラー制限を設定済み  
- [ ] 使用量制限を設定済み
- [ ] APIキーを定期的にローテーション
- [ ] 不正使用の監視設定

## 長期的な改善案

1. **サーバーサイドプロキシ**
   - Next.js API Routes経由でMaps APIを呼び出す
   - クライアントからAPIキーを完全に隠蔽

2. **動的キー生成**
   - セッション毎に制限付きAPIキーを生成
   - より細かい制御が可能

## 実装例（将来的な改善）

```typescript
// pages/api/maps/[...params].ts
export default async function handler(req, res) {
  const response = await fetch(`https://maps.googleapis.com/maps/api/${req.query.params.join('/')}?key=${process.env.GOOGLE_MAPS_API_KEY}&${new URLSearchParams(req.query)}`);
  const data = await response.json();
  res.json(data);
}
```

このように実装することで、APIキーをサーバーサイドでのみ管理できます。