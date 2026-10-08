---
name: nokoroa-autopilot
description: "計画承認後の完全自動開発サイクル。ブランチ作成→TDD並列実装→テスト検証（全pass）→専門家並列レビュー→ブラウザ確認→品質チェック→PR作成→マージ準備完了報告。Use when: (1) plan modeで作成した計画をユーザーが承認した直後、(2) 実装計画を実行したい、(3) ユーザーが「実装して」「進めて」「始めて」「計画を実行して」「オートパイロットで」と指示した場合。"
---

# Nokoroa Autopilot — 完全開発サイクル

計画承認から実装・テスト・レビュー・PRまでを自動化する**オーケストレータ**。詳細手順は `references/`、専門スキルへ委譲する。

---

## 全体フロー

```
[Phase 0]  計画読み込み
[Phase 1]  Featureブランチ作成
[Phase 2]  TDD並列実装                  → references/phase-details.md §実装
[Phase 3]  テスト検証ループ             → references/phase-details.md §テスト
[Phase 4]  専門家並列レビュー           → /nokoroa-review に委譲
[Phase 5]  ブラウザ動作確認             → /nokoroa-browser-test に委譲
[Phase 6]  品質チェック                 → references/phase-details.md §品質
[Phase 7]  PR作成                       → references/phase-details.md §PR
[Phase 8]  マージ準備完了報告           → references/completion-report.md
```

---

## 共通原則

### セッション継続
Phase 0〜8 を切らずに最後まで実行する。エラー・テスト失敗・レビュー指摘があってもセッションを切らず修正→再確認まで継続。

### Nokoroa固有の絶対厳守ルール
- `main` ブランチで直接実装しない（feature/ブランチを切る）
- 実装中は commit / push しない（マージはユーザー）
- buildしない（指示があるまで）
- DB・マイグレーションをリセットしない
- リモートから pull しない
- 不要なデバッグログ・コメントは削除（**既存ログは絶対に消さない**）
- PRに「Generated with Claude Code」を付けない
- コミットに `Co-Authored-By` を付けない

### 修正ループ
```
問題発見 → 原因分析 → 修正 → 修正箇所の再検証
  ├─ まだ問題あり → 再修正（最大3ループ）
  └─ 全解消       → 次のPhaseへ
```
3ループ超過 or 同一原因の繰り返し → ユーザーへ残エラー・試行差分・原因仮説・推奨アクションを報告。

### スコープ外バグ
実装・検証中に発見した今回のタスクと無関係なバグはその場で修正しない。Phase 8 の最終報告に集約する（概要 / 再現手順 / 関連ファイル / 推測原因）。

---

## Phase 0: 計画読み込み

`.claude/plans/` または指定ファイルから計画を読み込む。

## Phase 1: Featureブランチ作成

```bash
git checkout -b feature/<タスク概要のケバブケース>
```

main ブランチで直接実装してはいけない。既にブランチが切られている場合はスキップ。

## Phase 2: TDD並列実装

詳細手順: `references/phase-details.md` §実装

実装計画のタスクを依存関係に従って並列実行する。

## Phase 3: テスト検証ループ

詳細手順: `references/phase-details.md` §テスト

完了条件: Backend 単体テスト + E2E（該当時）が全 pass。

## Phase 4: 専門家並列レビューループ

`/nokoroa-review` に委譲。Critical 指摘がある場合は修正ループ → 指摘者のみ再レビュー。

## Phase 5: ブラウザ動作確認

`/nokoroa-browser-test` に委譲。変更箇所の動作を確認する。

## Phase 6: 品質チェック

詳細手順: `references/phase-details.md` §品質

Backend / Frontend の lint を変更箇所に応じて実行する。

## Phase 7: PR作成

詳細手順: `references/phase-details.md` §PR

クリーンアップ → コミット → push → `gh pr create` で PR 作成。

## Phase 8: マージ準備完了報告

> マージはユーザーが行う。Claudeはマージしてはいけない。

報告フォーマット: `references/completion-report.md`

PR URL とともに「マージの準備ができました」と報告して終了。

---

## Resources

| ファイル | 用途 |
|---|---|
| `references/phase-details.md` | Phase 2/3/6/7 の詳細手順 |
| `references/completion-report.md` | Phase 8 完了報告フォーマット |
| `/nokoroa-review` | Phase 4 専門家並列レビュー |
| `/nokoroa-browser-test` | Phase 5 ブラウザ動作確認 |
