---
name: nokoroa-bug-fix
description: "バグ修正の全工程を自動実行（ブランチ作成→調査→TDD実装→動作検証→クリーンアップ→品質チェック）。Use when: (1)「バグ直して」「修正して」「fix」と言われた、(2) 不具合報告を受けた、(3) エラー対応を依頼された場合。"
---

# Nokoroa Bug Fix Workflow

バグ修正の全工程を一気通貫で実行するスキル。

---

## Phase 1: 情報収集 & ブランチ準備

### Step 1: バグ内容の確認

ユーザーが貼り付けたバグ詳細から以下を抽出：

- **バグの概要**（何が起きているか）
- **再現手順**（あれば）
- **期待する動作**（あれば）

不足があれば質問する。

### Step 2: ブランチ作成

```bash
git checkout main
git checkout -b fix/<バグ概要をケバブケースで>
```

ユーザーにブランチ名を確認してから実行する。

---

## Phase 2: 原因調査 & 修正方針

### 調査手順

1. **情報収集** — 再現手順・期待する動作・実際の動作を把握
2. **コードベース調査** — 問題の発生箇所・根本原因・影響範囲を特定
3. **方針ドキュメント作成** — 修正内容・修正ファイル・テスト計画をまとめる

### 承認確認

**実装前に必ずユーザーに方針を提示し、承認を得ること。**

---

## Phase 3: TDD実装

承認後、TDDで実装：

1. **Red** - 失敗するテストを先に書く
2. **Green** - テストが通る最小限の実装
3. **Refactor** - コードを改善

---

## Phase 4: 動作検証

### ローカル検証

```bash
# テスト実行
cd nokoroa-backend && npm run test
cd nokoroa-backend && npm run test:e2e  # 該当する場合
```

### ブラウザ動作検証（Claude in Chrome）

`/nokoroa-browser-test` スキルを使って修正箇所の動作を検証。

---

## Phase 5: クリーンアップ

修正完了後、以下を確認:

```bash
git diff
```

**削除対象:**
- `console.log` / デバッグ用のログ出力（実装時に追加したもののみ。既存のログは絶対に消さない）
- コメントアウトされたコード
- 修正と無関係な変更
- テスト用の一時的なデータや設定

---

## Phase 6: 品質チェック & 完了

```bash
# Backend変更時
cd nokoroa-backend && npm run lint

# Frontend変更時
cd nokoroa-frontend && npm run lint
```

全passしたらユーザーに完了報告。
