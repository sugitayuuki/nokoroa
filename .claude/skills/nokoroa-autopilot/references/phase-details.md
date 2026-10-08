# Phase 詳細手順（nokoroa-autopilot）

SKILL.md から参照される詳細手順。Phase 2 実装 / Phase 3 テスト / Phase 6 品質チェック / Phase 7 PR を扱う。

---

## §実装: Phase 2 TDD並列実装

### 実装中の禁止事項
- commit / push（マージはユーザーが行う）
- build（指示があるまで）

### 実装手順
実装計画のタスクを依存関係に従って実行する。依存関係のないタスクは `Agent` tool で並列起動（`run_in_background: true`）。

### TDD必須手順（全エージェント共通）
1. 失敗するテストを先に書く（failing test first）
2. テストがpassする最小実装
3. リファクタリング

### 不要なログ・コメントの除去
実装完了後、追加されたデバッグ用ログやコメントを削除する。**既存ログは絶対に消さない**。

実装中のデバッグログには `[DEBUG]` / `[VERIFY]` プレフィックスを付け、Phase 7 のクリーンアップで一括削除しやすくする。

### 並列実行原則
- 依存なし → 全て同時起動
- 依存あり → 前段完了を待つ
- 同一ファイル編集は順次実行に切り替える

---

## §テスト: Phase 3 テスト検証ループ

完了条件（全て満たすまで Phase 4 へ進めない）:
- Backend 単体テストが全て pass
- Backend E2E テストが全て pass（該当する場合）

```bash
cd nokoroa-backend && npm run test
cd nokoroa-backend && npm run test:e2e  # 該当する場合
```

失敗時は共通原則の修正ループ。修正後は変更ファイルに対応するテストのみ再実行。

---

## §品質: Phase 6 品質チェック

```bash
# Backend変更時
cd nokoroa-backend && npm run lint

# Frontend変更時
cd nokoroa-frontend && npm run lint
```

エラー時は修正ループ（最大3ループ）。3ループで収束しない場合はユーザーに報告。

---

## §PR: Phase 7 PR作成

### クリーンアップ
```bash
# デバッグログ検出
grep -rn "\[DEBUG\]\|\[VERIFY\]" --include="*.ts" --include="*.tsx" nokoroa-backend/ nokoroa-frontend/ 2>/dev/null

# 通常の console.log（残してよいものと残すべきでないものを区別）
grep -rn "console\.log" --include="*.ts" --include="*.tsx" nokoroa-backend/ nokoroa-frontend/ 2>/dev/null \
  | grep -v "node_modules" | grep -v "console\.error"
```

実装で追加したデバッグログのみ削除し、既存ログは保持する。

### コミット & PR
```bash
git add [具体的なファイルパス]
git commit -m "feat: <変更内容>"
git push origin feature/<ブランチ名> -u
gh pr create --base main --title "<PRタイトル>" --body "$(cat <<'EOF'
## 概要
[何を・なぜ実装したか]

## 変更内容
- [変更点1]

## テスト・検証
- 単体テスト: ✅
- E2E: ✅
- レビュー: ✅
- ブラウザ確認: ✅
- 品質チェック: lint ✅

## デプロイ時の注意
- [環境変数等]
EOF
)"
```

### 禁止事項
- PR本文に「Generated with Claude Code」を付けない
- コミットに `Co-Authored-By` を付けない
- force push しない
- `git add -A` は使わない（個別ファイル指定）
