---
name: nokoroa-autopilot
description: "計画承認後の完全自動開発サイクル。ブランチ作成→TDD並列実装→テスト検証（全pass）→専門家並列レビュー→ブラウザ確認→品質チェック→PR作成→マージ準備完了報告。Use when: (1) plan modeで作成した計画をユーザーが承認した直後、(2) 実装計画を実行したい、(3) ユーザーが「実装して」「進めて」「始めて」「計画を実行して」「オートパイロットで」と指示した場合。"
---

# Nokoroa Autopilot — 完全開発サイクル

計画承認から実装・テスト・レビュー・PRまでを自動化する統合開発フロー。

---

## 共通原則

### セッション継続

Phase 0〜8まで、セッションを途中で切らずに最後まで実行する。エラー・テスト失敗・レビュー指摘があってもセッションを切らずに修正→再確認まで継続する。

### 修正ループの共通パターン

```
問題発見（テスト失敗・レビュー指摘・品質エラー）
    ↓
原因分析 → 修正 → 修正箇所のテスト再実行 → まだ問題あり？ → 再び修正
    ↓（全解消）
次のPhaseへ
```

---

## 全体フロー

```
[Phase 0]  計画読み込み
    ↓
[Phase 1]  Featureブランチ作成
    ↓
[Phase 2]  TDD並列実装（Sub Agents）
    ↓
[Phase 3]  テスト検証ループ（全pass）
    ↓
[Phase 4]  専門家並列レビューループ（/nokoroa-review）
    ↓
[Phase 5]  ブラウザ動作確認（/nokoroa-browser-test）
    ↓
[Phase 6]  品質チェック（/nokoroa-dev）
    ↓
[Phase 7]  PR作成
    ↓
[Phase 8]  マージ準備完了報告
```

---

## Phase 0: 計画読み込み

`.claude/plans/` または指定ファイルから計画を読み込む。

## Phase 1: Featureブランチ作成

```bash
git checkout -b feature/[タスク概要をケバブケースで]
```

`main` ブランチで直接実装してはいけない。既にブランチが切られている場合はスキップ。

## Phase 2: TDD並列実装

> **実装中は commit も push も行ってはいけない。**

実装計画のタスクを依存関係に従って実行する。依存関係のないタスクはAgent toolで並列起動。

### TDD必須手順（全エージェント共通）

1. テストを先に書く（failing test first）
2. テストがpassする最小限の実装
3. リファクタリング

### 不要なログ・コメントの除去

実装完了後、追加されたデバッグ用ログやコメントを削除する（既存のログは絶対に消さない）。

## Phase 3: テスト検証ループ

**完了条件（全て満たすまで次に進めない）:**
- Backend単体テストが全てpass
- Backend E2Eテストが全てpass（該当する場合）

```bash
cd nokoroa-backend && npm run test
cd nokoroa-backend && npm run test:e2e  # 該当する場合
```

## Phase 4: 専門家並列レビューループ

`/nokoroa-review` スキルを起動。Critical指摘がある場合は修正→再レビュー。

## Phase 5: ブラウザ動作確認

`/nokoroa-browser-test` スキルで変更箇所の動作を確認。

## Phase 6: 品質チェック

```bash
# Backend変更時
cd nokoroa-backend && npm run lint

# Frontend変更時
cd nokoroa-frontend && npm run lint
```

## Phase 7: PR作成

`gh pr create` でPRを作成。PRには以下を含める:
- 変更の概要
- テスト結果のサマリー
- レビュー結果のサマリー

## Phase 8: マージ準備完了報告

> **マージはユーザーが行う。ClaudeはPRをマージしてはいけない。**

**ユーザーへの報告内容:**
- [ ] 全テストpass
- [ ] 全専門家LGTM
- [ ] ブラウザ動作確認完了
- [ ] 品質チェック全pass
- [ ] 不要なログ・コメント削除済み

PRのURLとともに「マージの準備ができました」と報告して終了。
