# API設計書

## 1. 概要

- ベースURL: `https://nokoroa.com/api` (本番、フロントと同一オリジン) / `http://localhost:4000/api` (開発)
- 認証: **httpOnly クッキー `nokoroa_token`**（JWT）。ブラウザからの経路はこれが正。
  - `Authorization: Bearer <JWT>` も受け付ける（Swagger / E2E 用）。
    両方ある場合は**クッキーが優先**される（`src/auth/jwt.strategy.ts`）。
  - ブラウザからの fetch は `credentials: 'include'` が必須。
  - クロスサイト（`Sec-Fetch-Site: cross-site`）からのリクエストは
    `/auth/google` と `/auth/google/callback` を除き 403 で拒否される。
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

**レスポンス (201)**

`Set-Cookie` で認証クッキーとログイン状態ヒントを発行する。
`Cache-Control: no-store` 付き。

```
Set-Cookie: nokoroa_token=<JWT>; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: nokoroa_session=1; Max-Age=86400; Path=/; Secure; SameSite=Lax
```

本文の `access_token` は Swagger / E2E 用に残している。ブラウザは使わない。

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

### GET /auth/me
ログイン中のユーザーを返す（要認証）

セッションの本人情報のみを返す。bio や投稿一覧まで必要な場合は
`GET /users/profile` を使う。`Cache-Control: no-store` 付き。

**レスポンス (200)**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "avatar": null
}
```

**エラー (401)**: 未認証、またはユーザーが存在しない

---

### POST /auth/logout
認証クッキーを削除する

httpOnly クッキーはフロントから削除できないため、サーバー側で消す。
**認証は不要**（クッキーが既に失効していてもログアウトできる必要があるため）。
冪等。

**レスポンス (200)**
```json
{ "message": "ログアウトしました" }
```

---

### GET /auth/google
Google OAuth認証開始

CSRF 検証用に `nokoroa_oauth_state` クッキー（httpOnly / SameSite=Lax / 10分）を
発行し、同じ値を認可 URL の `state` に載せる。

**レスポンス**: Googleログイン画面へリダイレクト

---

### GET /auth/google/callback
Google OAuth認証コールバック

`state` がクッキーと一致しない場合は 401（ログイン CSRF / セッション固定の防止）。
Google 側で未確認のメールアドレスも 401 で拒否する。

**レスポンス (302)**: `Set-Cookie` で認証クッキーを発行し、
`${FRONTEND_URL}/auth/callback` へリダイレクトする。
**トークンもユーザー情報も URL に載せない**（履歴・アクセスログ・Referer に残るため）。
フロントは着地後に `GET /auth/me` で本人を取得する。

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
