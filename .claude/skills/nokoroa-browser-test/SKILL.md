---
name: nokoroa-browser-test
description: "Nokoroaアプリのブラウザ動作検証。ログイン認証、投稿操作、プロフィール、検索、ブックマークなどをClaude in Chrome MCPツールで実行。Use when: ユーザーが「テストして」「確認して」「検証して」「ブラウザで見て」などブラウザ操作を指示した場合。"
---

# Nokoroa Browser Test

Claude in Chrome MCPツール（`mcp__claude-in-chrome__*`）でNokoroaアプリの動作を自動検証するスキル。

## 共通原則

### 事実ベース検証（推測禁止）

要素が見つからない / 動作が想定と違うとき、**「〜かもしれない」で推測しない**。
事実で検証する：

1. `read_page(filter: "interactive")` で実際のページ構造を確認
2. `read_console_messages(onlyErrors: true)` でJSエラーを確認
3. `read_network_requests` で API呼び出しの成否を確認
4. それでも不明なら、検証可能な仮説に絞り込んでから次の操作

「動かない」を「DOMに要素がない」「APIが401を返している」など事実に翻訳してから報告する。

### スコープ外バグの扱い

検証中に**今回の検証対象と無関係な問題**を見つけても、その場で修正しない。
最終報告に「スコープ外で見つけた問題」として概要・再現手順・関連URL・コンソールログを列挙する。

---

## 共通フロー

**すべてのワークフローは以下の手順で開始する。**

```
1. tabs_context_mcp → 既存タブ確認
2. tabs_create_mcp → テスト用タブ作成（以降このtabIdを使用）
3. gif_creator(action: "start_recording") → GIF記録開始
4. navigate(url: "<対象URL>") → ページ移動
5. computer(action: "wait", duration: 2) → ロード待機
6. read_page(filter: "interactive") → ページ構造確認
```

**検証完了時は以下で締める:**

```
1. read_page → 最終状態確認
2. computer(action: "screenshot") → スクリーンショット記録
3. gif_creator(action: "stop_recording")
4. gif_creator(action: "export", download: true, filename: "<workflow名>.gif")
```

**対象アプリURL:**
- Frontend: http://localhost:3000（ローカル） / https://nokoroa.com（本番）
- Backend API: http://localhost:4000（ローカル） / https://nokoroa.com/api（本番）

## ワークフロー選択

```
ユーザー指示
├─ "ログイン"/"認証" → Login
├─ "投稿"/"ポスト" → Post
├─ "プロフィール" → Profile
├─ "検索" → Search
├─ "ブックマーク" → Bookmark
├─ "フォロー" → Follow
└─ "全て"/"すべて" → 上記すべて順次実行
```

## Login

共通フローでログインページ（`/login`）へ移動後:

1. **入力・実行**
   ```
   form_input(ref: <email-ref>, value: <email>)
   form_input(ref: <password-ref>, value: <password>)
   computer(action: "left_click", ref: <login-button-ref>)
   computer(action: "wait", duration: 2)
   ```
2. **確認** — ホーム画面表示、URL変更、エラー無し
3. **オプション**: `javascript_tool(text: "localStorage.getItem('token')")` でトークン確認

## Post

認証が必要。まずLoginを実行後:

1. **投稿作成** — `/post/new` へ移動 → フォーム入力 → 送信
2. **投稿一覧** — `/posts` で投稿表示確認
3. **投稿詳細** — `/posts/[id]` で詳細表示確認
4. **投稿編集** — `/posts/[id]/edit` で編集 → 保存

## Profile

1. **プロフィール表示** — `/profile` へ移動 → ユーザー情報表示確認
2. **プロフィール編集** — `/profile/edit` → フォーム入力 → 保存

## Search

1. **検索ページ** — `/search` へ移動
2. **キーワード検索** — 検索フォームに入力 → 結果表示確認
3. **タグ検索** — タグクリック → フィルタ結果確認

## Bookmark

認証が必要:

1. **ブックマーク追加** — 投稿のブックマークボタンクリック
2. **ブックマーク一覧** — `/bookmarks` で保存済み投稿表示確認
3. **ブックマーク解除** — ブックマークボタン再クリック → 解除確認

## Follow

認証が必要:

1. **フォロー** — ユーザーページでフォローボタンクリック
2. **フォロワー/フォロー中一覧** — `/users/[id]/followers`, `/users/[id]/following` 表示確認

## エラー発生時

`read_console_messages(onlyErrors: true)` と `read_network_requests(urlPattern: "/api/")` で状況把握。詳細は `/nokoroa-troubleshooting` を参照。

## Best Practices

1. **必ずtabs_create_mcpで新規タブ作成** — 既存タブを再利用しない
2. **read_pageで構造確認してから操作** — スクリーンショットよりアクセシビリティツリー優先
3. **findで要素検索** — refが不明な場合に自然言語で探索
4. **GIF記録は常時** — 共通フローに組み込み済み

---

## オプション: 並列テスターパターン（大規模機能向け）

複雑な機能（投稿フロー全体、検索結果の網羅検証など）は、Sub Agentで以下を並列実行できる：

| テスター | 役割 | 例 |
|---------|------|----|
| デスクトップ動線 | 想定どおりの正常系を一気通貫で確認 | ログイン→投稿→一覧→詳細 |
| モバイル動線 | `resize_window` でビューポートを変えて確認 | 375x667 / 414x896 |
| エッジケース | 連打 / 空入力 / 巨大入力 / オフライン状態 | 投稿ボタン10回連打、空文字送信 |

各テスターは独立タブ（独立tabId）で実行し、最後に結果を集約。
**通常の検証には必須ではない** — フィードのリリース等、リスクが高い変更時のみ起動。
