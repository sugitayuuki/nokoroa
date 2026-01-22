# API設計書

## 1. 概要

- ベースURL: `https://api.nokoroa.com` (本番) / `http://localhost:4000` (開発)
- 認証: Bearer Token (JWT)
- フォーマット: JSON

---

## 2. 認証API

### POST /auth/login
ユーザーログイン

**リクエスト**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス (200)**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**エラー (401)**
```json
{
  "statusCode": 401,
  "message": "メールアドレスまたはパスワードが間違っています"
}
```

---

### GET /auth/google
Google OAuth認証開始

**レスポンス**: Googleログイン画面へリダイレクト

---

### GET /auth/google/callback
Google OAuth認証コールバック

**レスポンス**: フロントエンドへリダイレクト(JWTトークン付与)

---

## 3. ユーザーAPI

### POST /users/signup
ユーザー新規登録

**リクエスト**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "password": "password123"
}
```

**レスポンス (201)**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### GET /users/:id
ユーザー情報取得

**レスポンス (200)**
```json
{
  "id": 1,
  "name": "User Name",
  "email": "user@example.com",
  "bio": "自己紹介",
  "avatar": "https://s3.../avatar.jpg",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "_count": {
    "posts": 10,
    "followers": 5,
    "following": 3
  }
}
```

---

### PUT /users/profile
プロフィール更新 (認証必須)

**リクエスト**
```json
{
  "name": "New Name",
  "bio": "新しい自己紹介"
}
```

**レスポンス (200)**
```json
{
  "id": 1,
  "name": "New Name",
  "bio": "新しい自己紹介"
}
```

---

### POST /users/avatar
アバター画像アップロード (認証必須)

**リクエスト**: `multipart/form-data`
- `file`: 画像ファイル (jpg/jpeg/png/gif/webp, 5MB以下)

**レスポンス (200)**
```json
{
  "avatar": "https://s3.../avatar.jpg"
}
```

---

### GET /users/:id/posts
ユーザーの投稿一覧

**クエリパラメータ**
- `limit`: 取得件数 (デフォルト: 10)
- `offset`: オフセット (デフォルト: 0)

**レスポンス (200)**
```json
{
  "posts": [...],
  "total": 100
}
```

---

## 4. 投稿API

### GET /posts
投稿一覧取得

**クエリパラメータ**
- `limit`: 取得件数 (デフォルト: 10, 最大: 50)
- `offset`: オフセット (デフォルト: 0)

**レスポンス (200)**
```json
{
  "posts": [
    {
      "id": 1,
      "title": "沖縄旅行",
      "content": "本文...",
      "imageUrl": "https://s3.../image.jpg",
      "isPublic": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "author": {
        "id": 1,
        "name": "User Name",
        "avatar": "https://s3.../avatar.jpg"
      },
      "location": {
        "name": "沖縄県",
        "country": "日本",
        "latitude": 26.2124,
        "longitude": 127.6809
      },
      "tags": [
        { "id": 1, "name": "海", "slug": "sea" }
      ]
    }
  ],
  "total": 100
}
```

---

### GET /posts/:id
投稿詳細取得

**レスポンス (200)**
```json
{
  "id": 1,
  "title": "沖縄旅行",
  "content": "本文...",
  "imageUrl": "https://s3.../image.jpg",
  "isPublic": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "author": {...},
  "location": {...},
  "tags": [...],
  "isBookmarked": false
}
```

---

### POST /posts
投稿作成 (認証必須)

**リクエスト**
```json
{
  "title": "沖縄旅行",
  "content": "本文...",
  "imageUrl": "https://s3.../image.jpg",
  "isPublic": true,
  "location": {
    "name": "沖縄県",
    "country": "日本",
    "prefecture": "沖縄県",
    "latitude": 26.2124,
    "longitude": 127.6809
  },
  "tags": ["海", "沖縄"]
}
```

**レスポンス (201)**
```json
{
  "id": 1,
  "title": "沖縄旅行",
  ...
}
```

---

### PUT /posts/:id
投稿更新 (認証必須、投稿者のみ)

**リクエスト**
```json
{
  "title": "更新後のタイトル",
  "content": "更新後の本文"
}
```

---

### DELETE /posts/:id
投稿削除 (認証必須、投稿者のみ)

**レスポンス (200)**
```json
{
  "message": "投稿を削除しました"
}
```

---

### POST /posts/upload-image
画像アップロード (認証必須)

**リクエスト**: `multipart/form-data`
- `file`: 画像ファイル

**レスポンス (200)**
```json
{
  "imageUrl": "https://s3.../image.jpg"
}
```

---

### GET /posts/search
投稿検索

**クエリパラメータ**
- `keyword`: 検索キーワード
- `tags`: タグ (カンマ区切り)
- `limit`: 取得件数
- `offset`: オフセット

---

### GET /posts/search/location
位置情報検索

**クエリパラメータ**
- `latitude`: 緯度
- `longitude`: 経度
- `radius`: 検索半径 (km)

---

## 5. フォローAPI

### POST /follows/:userId
フォロー (認証必須)

**レスポンス (201)**
```json
{
  "message": "フォローしました"
}
```

---

### DELETE /follows/:userId
アンフォロー (認証必須)

**レスポンス (200)**
```json
{
  "message": "フォロー解除しました"
}
```

---

### GET /follows/:userId/followers
フォロワー一覧

---

### GET /follows/:userId/following
フォロー中一覧

---

### GET /follows/:userId/status
フォロー状態確認 (認証必須)

**レスポンス (200)**
```json
{
  "isFollowing": true
}
```

---

## 6. ブックマークAPI

### POST /favorites/:postId
ブックマーク追加 (認証必須)

---

### DELETE /favorites/:postId
ブックマーク削除 (認証必須)

---

### GET /favorites
ブックマーク一覧 (認証必須)

---

## 7. エラーレスポンス

| ステータスコード | 意味 |
|-----------------|------|
| 400 | リクエスト不正 |
| 401 | 認証エラー |
| 403 | 権限なし |
| 404 | リソースが見つからない |
| 409 | 競合 (重複登録など) |
| 500 | サーバーエラー |

**エラーレスポンス形式**
```json
{
  "statusCode": 400,
  "message": "エラーメッセージ",
  "error": "Bad Request"
}
```
