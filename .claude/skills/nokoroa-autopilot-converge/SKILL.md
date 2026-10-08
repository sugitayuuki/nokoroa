---
name: nokoroa-autopilot-converge
description: "/nokoroa-autopilot + /nokoroa-review 収束ループを組み合わせた上位開発フロー。/nokoroa-autopilot で実装〜PR作成 → /nokoroa-review を「P0+P1 連続 2 ラウンド 0 件」になるまで最大 5 ラウンド回す → 累積 P2 課題と未解決指摘を**報告のみ**で締める (自動起票はしない)。Nokoroa 専用 (NestJS backend + Next.js frontend + Terraform 構成)。Use when: (1) `/nokoroa-autopilot-converge` と入力された、(2)「ノコロアでオートパイロット収束」「収束付きで実装して」「強化版オートパイロット」「nokoroa を厳密に」と指示された場合、(3) 単発の /nokoroa-autopilot より厳密な品質保証が必要な開発タスク。"
user-invocable: true
---

# nokoroa-autopilot-converge — Nokoroa 収束保証付き完全自動開発サイクル

`/nokoroa-autopilot` の実装フロー終了後に `/nokoroa-review` を **連続 2 ラウンド P0+P1 = 0 件** になるまでループ実行し、累積 [OUT] 課題を **報告のみ** で締めくくる上位スキル (自動起票は絶対にしない)。

汎用 `/autopilot-converge` の Nokoroa 専用版。違いは:
- 基盤 autopilot: `/nokoroa-autopilot` (NestJS/Next.js/Terraform 固有)
- レビュー: `/nokoroa-review` (5 専門家固定: コード品質 / セキュリティ / パフォーマンス / API 設計 / フロントエンド)
- 重大度ラベル: **P0 / P1 / P2** (Critical / High / Medium ではない)
- Nokoroa 固有ルール厳守 (build 禁止 / DB リセット禁止 / 「Generated with Claude Code」禁止 等)

---

## 設計原則

- **`/nokoroa-autopilot` と `/nokoroa-review` には触らない**: 既存スキルは無変更。本スキルが上位ワークフローとして組み合わせる
- **収束保証**: 「1 ラウンド 0 件」ではなく「**連続 2 ラウンド 0 件**」で収束判定 (誤検知防止)
- **無限ループ防止**: 上限 **5 ラウンド** を超えたら強制終了 (収束未達でも報告)
- **[OUT] は報告のみ・自動起票しない**: 累積した P2 課題や未解決 P1 は完了報告に列挙するだけ。Issue 自動起票は **絶対に行わない**
- **Nokoroa ルール厳守**:
  - `main` ブランチで直接実装しない
  - **build しない** (`npm run build` 系)
  - DB / マイグレーションをリセットしない
  - リモートから pull しない
  - 既存ログは絶対に消さない
  - PR に「Generated with Claude Code」を付けない
  - コミットに `Co-Authored-By` を付けない

---

## 全体フロー

```
[Phase A-0] ブランチ命名 + worktree 自動作成 (デフォルト)
    ↓
[Phase A]  /nokoroa-autopilot 実行 (worktree 内 / 実装〜PR 作成 / Phase 0-8 相当)
    ↓
[Phase B]  /nokoroa-review 収束ループ
    ├ Round N: /nokoroa-review 実行 (毎回観点を意識的に分散)
    ├ P0/P1 発見?
    │   ├ Yes → 修正コミット → Round N+1 へ (consecutive_zero リセット)
    │   └ No → consecutive_zero++
    ├ 終了条件:
    │   ├ consecutive_zero >= 2 → 🟢 収束
    │   ├ Round >= 5 → 🟡 上限到達
    │   └ いずれかで Phase C へ
    ↓
[Phase C]  累積 P2 + 未解決 P1 を**報告のみで列挙** (自動起票しない)
    ↓
[Phase D]  マージ準備完了報告 (PR URL + 累積課題サマリ + worktree クリーンアップ提案 + 残作業)
```

---

## Phase A-0: ブランチ命名 + worktree 自動作成 (デフォルト動作)

**毎回のタスクで `ブランチ + 同名 worktree` をワンセットで自動作成する**。タスクごとに必ず隔離環境で作業する設計。

### 標準フロー (毎回実行)

1. **ベースブランチ最新化**:
   ```bash
   cd /Users/sugitayuuki/nokoroa
   git fetch origin 2>/dev/null || echo "[warn] git fetch failed (offline?)"
   base=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
   base="${base:-main}"
   ```
2. **ブランチ名命名規約**: タスク内容から決定
   - 機能追加: `feature/<topic-kebab>` (例: `feature/user-profile-edit`)
   - バグ修正: `fix/<topic-kebab>`
   - リファクタ: `refactor/<topic-kebab>`
   - Nokoroa は `feature/` プレフィックス慣行 (`nokoroa-autopilot` Phase 1 参照)
3. **worktree path の決定**:
   ```bash
   repo_root=$(git rev-parse --show-toplevel)
   repo_parent=$(dirname "$repo_root")
   repo_name=$(basename "$repo_root")
   branch_suffix=$(echo "$branch_name" | tr '/' '-' | sed 's/[^A-Za-z0-9_-]/_/g')
   target="$repo_parent/$repo_name-$branch_suffix"
   ```
4. **path 衝突事前チェック**:
   ```bash
   if git worktree list --porcelain | grep -qFx "worktree $target"; then
     target="$target-$(date +%s)"
   fi
   ```
5. **worktree 作成**:
   ```bash
   git worktree add -b "$branch_name" "$target" "$base"
   ```
6. **cwd 切替**: 以降のすべての Bash / Edit / Read は `"$target"` 配下で実行
7. **依存再インストール** (Nokoroa は monorepo 構成):
   ```bash
   # backend
   [ -d nokoroa-backend/node_modules ] || (cd nokoroa-backend && npm ci)
   # frontend
   [ -d nokoroa-frontend/node_modules ] || (cd nokoroa-frontend && npm ci)
   # ai (任意 / Python venv は project policy に従う)
   ```
   - autopilot 側で再 install が必要になった場合 (例: prisma generate) は autopilot に委譲
8. **Prisma generate** (backend に変更が想定される場合のみ):
   ```bash
   # autopilot 側で実施するので本スキルでは触らない
   ```
9. ユーザー報告: 「`$branch_name` を作成、worktree `$target` で作業します」

### 失敗時の fallback

| 失敗種別 | 対応フロー |
|---|---|
| 同名 branch 既存 | suffix `-2` / `-3` で再試行、3 回失敗で **通常モード fallback 確認** |
| 同名 path 既存 | step 4 内で epoch suffix 付加 (自動継続) |
| base 未取得 | エラー全文報告 → 「オフライン or 認証問題? 通常モードで進める or 中断?」確認 |
| ディスク容量不足 | **即座にユーザー報告 → 中断** (自動 fallback しない) |
| 親 dir 書込権限なし | エラー全文報告 → ユーザー判断 |
| node_modules 不足で npm ci 失敗 | エラー報告 → ユーザー判断 (権限 / ネットワーク?) |

### opt-out

- ユーザーが「worktree 不要」「いつもの場所で」と明示した場合は通常モードに切替
- 通常モード時: `git checkout -b "$branch_name" "$base"` で同名 branch のみ作成、cwd は元 repo のまま

---

## Phase A: /nokoroa-autopilot 実行

Phase A-0 で worktree + branch 作成済 + cwd 切替済。この状態で `/nokoroa-autopilot` を呼び出す:

- Phase 0 (計画読み込み) 〜 Phase 8 (マージ準備完了報告) を実行
- ユーザー承認・対話は `/nokoroa-autopilot` のフローに従う
- Phase 4 (専門家並列レビュー) と Phase 5 (ブラウザ動作確認) も `/nokoroa-autopilot` の通常フローで実施
- Phase 7 (PR 作成) で PR URL が発行される

worktree モード前提:
- cwd は `$target` の worktree path
- branch は既に Phase A-0 で作成済 → autopilot 側で重複作成を試みても安全に止まる
- autopilot が「同名 branch が既にあるためスキップ」「`git switch` で乗る」のいずれかで継続

完了時に **PR URL** と **head ブランチ名** と **worktree path** を保持しておく (Phase B / D で使用)。

---

## Phase B: /nokoroa-review 収束ループ

### 状態変数

```
consecutive_zero = 0   # 連続 P0+P1 = 0 件のカウント
round = 0              # ラウンド番号
cumulative_findings = []  # 累積 P0/P1/P2 課題リスト (de-dup 用)
```

### ループ本体

```
while True:
    round += 1

    # 上限チェック
    if round > 5:
        終了: 🟡 上限到達 (収束未達)
        break

    # /nokoroa-review 実行
    /nokoroa-review
        - mainHEAD 差分を対象に
        - 5 専門家から差分内容に応じて 1-5 名を起動
        - P0/P1/P2 ラベルで指摘を分類

    # 結果分類
    p0_count = /nokoroa-review が返す P0 件数
    p1_count = /nokoroa-review が返す P1 件数
    p2_items = /nokoroa-review が返す P2 全件
    cumulative_findings += {全 P0/P1/P2}

    # 判定
    if p0_count == 0 and p1_count == 0:
        consecutive_zero += 1
        if consecutive_zero >= 2:
            終了: 🟢 収束達成
            break
        # else: 次ラウンドへ
    else:
        consecutive_zero = 0  # リセット

        # 修正ループ (1 PR 内で対応可能なものを反映)
        - P0 / P1 に対する修正をエージェント or 手動実装
        - **既存ログは絶対に消さない**
        - **不要なデバッグログ・コメントのみ削除**
        - commit & push (PR ブランチに、`Co-Authored-By` 禁止 / 「Generated with Claude Code」禁止)
        - 次ラウンドは修正後コードで再評価
```

### 観点分散 (ラウンド間の重複回避)

`/nokoroa-review` は 5 専門家固定のため、汎用 `/adaptive-review` のような無限観点ドロワーは持たない。代わりに本スキル側で以下を意識する:

- **Round 1**: 全 5 専門家を起動 (差分が backend/frontend 両方に触れる場合)
- **Round 2 以降**: 前ラウンドで P0/P1 を出した専門家 + **観点の角度を変える指示** を付与
  - 例: 同じ「セキュリティ」担当でも Round 1 で認証視点 → Round 2 で入力バリデーション視点 → Round 3 で SQL/Prisma クエリ視点
- **指示プロンプト例** (Round 2 以降):
  > 「前ラウンドで {過去観点} を確認済み。今回は {次の観点角度} の視点で再レビューしてください」

### 修正コミットの命名規約

```
fix(review): <専門家>: <P0/P1 サマリ>

例:
fix(review): セキュリティ: JWT ガード未適用エンドポイントを修正
fix(review): API設計: DTO バリデーション不足を補完
fix(review): フロントエンド: useEffect の依存配列漏れを修正
```

- `Co-Authored-By` 禁止
- 「Generated with Claude Code」禁止

### 中断ルール

- ユーザーが明示的に中断指示した場合は即座に Phase C へ進む
- 修正ループが 2 回失敗 (同じ P0 が解消しない) したら Phase C へ進み、未解決 [IN] を報告に明記
- ブラウザ動作確認 (`/nokoroa-browser-test`) で起動失敗が発生した場合は環境問題として隔離報告

---

## Phase C: 累積課題の整理 (報告のみ・自動起票しない)

### 絶対ルール

- **`gh issue create` 等の自動起票は絶対に行わない**
- `cumulative_findings` は **Phase D の完了報告に列挙するだけ**
- ユーザーが「Issue 起票して」と明示的に指示した場合のみ、別途その指示に従って起票する

### 整理手順

1. `cumulative_findings` から重大度別 (P0 / P1 / P2) に分類
2. 同一 `path:line` の指摘を de-dup
3. **未解決 P0 / P1** (収束ループで解消しきれなかったもの) と **任意 P2** を区別
4. Phase D 用のマークダウンテーブルに整形 (path:line 形式、自然言語サマリのみ)
5. コード本文・関数定義・スタックトレース転記は禁止

---

## Phase D: マージ準備完了報告

### 報告フォーマット

```
=== nokoroa-autopilot-converge 完了報告 ===

## モード
- 実行モード: 🟢 通常モード (checkout -b) / 🟠 worktree モード
- worktree path: <path> (worktree モード時のみ)
- ベースリポジトリ: /Users/sugitayuuki/nokoroa

## PR
- URL: https://github.com/{owner}/{repo}/pull/{N}
- ベースブランチ: {base}
- ヘッドブランチ: {head}
- CI 状態: {SUCCESS / PENDING / FAILURE}

## レビュー収束状態
- 実行ラウンド数: {round} / 5
- 収束判定: 🟢 連続 2 ラウンド 0 件達成 / 🟡 上限到達 / 🔴 未収束で中断
- 累積修正済 P0/P1: {count}
- 残存 P0 / P1: {count} (収束不可なら明記)

## 累積課題 一覧 (自動起票していません — 必要ならユーザー指示で起票)

### 未解決 P0 (Critical / マージブロッカー)
| # | path:line | 専門家 | サマリ |
|---|---|---|---|
| 1 | ... | ... | ... |

### 未解決 P1 (Warning / 判断で見送り可)
| # | path:line | 専門家 | サマリ |
|---|---|---|---|

### P2 (Suggestion / 任意改善)
- {1 行サマリ × N 件}

## 残作業
- [ ] 未解決 P0 の解消 (マージブロッカー)
- [ ] staging / 本番動作確認 (人間)
- [ ] PR review (人間)
- [ ] 上記 P2 のうち実施判断 (ユーザー指示後に対応)
- (任意 / worktree モード時のみ) PR マージ後に `git worktree remove <path>` でクリーンアップ — `/worktree-cleanup` でも可。レビュー中は残置推奨

## Nokoroa 固有チェック
- [ ] DB / マイグレーションをリセットしていない
- [ ] build を実行していない
- [ ] 既存ログを削除していない
- [ ] リモートから pull していない
- [ ] PR に「Generated with Claude Code」を付けていない
- [ ] コミットに `Co-Authored-By` を付けていない
```

---

## 設定パラメータ (デフォルト固定)

| 項目 | 値 |
|---|---|
| 連続 0 件閾値 | **2** ラウンド |
| 上限ラウンド | **5** ラウンド |
| 重大度ラベル | **P0 / P1 / P2** (Nokoroa 標準) |
| 収束対象 | **P0 + P1 = 0** (P2 は収束条件に含めない) |
| 自動起票 | **しない** (報告のみ) |
| 基盤 autopilot | `/nokoroa-autopilot` のみ |
| レビュー | `/nokoroa-review` のみ |
| worktree モード | **デフォルト常時 ON** |
| worktree path 命名 | `<repo-parent>/<repo-name>-<branch-suffix>` |
| 衝突時 fallback | 同 path 既存 → epoch suffix → 3 回失敗で通常モード fallback |
| opt-out 経路 | ユーザーが「worktree 不要」と明示した場合のみ通常モード |

---

## 制約・前提

### 前提
- `/nokoroa-autopilot` `/nokoroa-review` が利用可能
- Nokoroa リポジトリ (`/Users/sugitayuuki/nokoroa`) で実行
- PR base ブランチが明確 (autopilot で作成されたもの)

### 制約
- 本スキルは **`/nokoroa-autopilot` 後** にしか使わない (autopilot を内包しない単独レビュー用途は `/nokoroa-review` を直接呼ぶ)
- 修正ループが収束しないケースでは Phase C にスキップして報告 (無限ループ防止)
- `/nokoroa-review` の verbatim 再検証機構は無いため、IN-scope 暴走防止は `mainHEAD` 差分の物理的範囲のみが保証
- Terraform 変更を含む場合は本スキル対象外 (インフラ変更は別運用)

---

## アンチパターン

- ❌ `/nokoroa-review` を呼ばずに「収束したことにする」(必ず実 Round を回す)
- ❌ 連続 0 件閾値を 1 に下げる (誤検知防止のため 2 が下限)
- ❌ 上限 5 を超えて回す (観点枯渇でほぼ P2 のみになり費用対効果ゼロ)
- ❌ **`gh issue create` 等で課題を自動起票する** (ユーザー指示なしでの起票は絶対禁止)
- ❌ コード本文を報告に転記する (`path:line` 形式のみ)
- ❌ **worktree を作らず main / 既存ブランチに直接 commit する** (デフォルト ON、毎回隔離が原則)
- ❌ ユーザーの opt-out 明示なしで通常モードに切り替える
- ❌ worktree モード時に元の worktree (= main 等) を直接編集する
- ❌ 修正中に **既存ログを削除する** (Nokoroa CLAUDE.md 違反)
- ❌ 修正中に **build を実行する** (Nokoroa CLAUDE.md 違反)
- ❌ 修正中に **DB / マイグレーションをリセットする** (Nokoroa CLAUDE.md 違反)
- ❌ **`Co-Authored-By` 行** をコミットメッセージに含める
- ❌ **「Generated with Claude Code」** を PR description に含める

---

## 関連スキルとの使い分け

| 状況 | スキル |
|---|---|
| 単発レビュー (Nokoroa) | `/nokoroa-review` |
| 実装〜PR 作成のみ (Nokoroa) | `/nokoroa-autopilot` |
| バグ修正単発 (Nokoroa) | `/nokoroa-bug-fix` |
| ブラウザ動作確認単発 (Nokoroa) | `/nokoroa-browser-test` |
| **実装〜収束レビュー〜課題報告まで一気通貫 (Nokoroa)** | **`/nokoroa-autopilot-converge`** (本スキル) |
| 汎用プロジェクト用 | `/autopilot-converge` |

---

## 呼び出し方

```
/nokoroa-autopilot-converge

(または自然文)
ノコロアで収束付きオートパイロットして
nokoroa で強化版オートパイロットで進めて
nokoroa を厳密に実装してレビューまで
```

Phase A-0 (worktree) → Phase A (`/nokoroa-autopilot`) → Phase B (`/nokoroa-review` 収束ループ最大 5 回 / 連続 2 回 0 件で抜ける) → Phase C (累積課題を**報告のみ整理**・自動起票は絶対しない) → Phase D (完了報告)。
