---
name: nokoroa-deploy
description: "Nokoroa本番デプロイ（DockerイメージビルドARM64→ECRプッシュ→ECSタスク定義更新→サービス再デプロイ→ヘルスチェック確認）。Use when: (1) 本番にデプロイしたい、(2)「デプロイして」「本番反映して」「ECSにプッシュして」と指示された場合、(3) ECSの起動・停止を操作したい場合"
---

# Nokoroa Deploy — AWS ECS デプロイ

## 前提条件

- AWS CLIがインストール・認証済み（`aws sts get-caller-identity` で確認）
- Dockerが起動済み
- ECRリポジトリ: `<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend` / `nokoroa-frontend` / `nokoroa-ai`
- ECSクラスター: `nokoroa-prod-cluster`
- **アーキテクチャ: ARM64（Graviton）** — 必ず `--platform linux/arm64` でビルドすること
- **構成**: backend と AI service は同一 ECS task に sidecar として同居（backend が `http://localhost:8000` で AI を呼ぶ）。AI 単独サービスは存在しない

## 鉄則

- **既存ログは絶対に消さない**（実装中に追加したデバッグログのみ削除対象）
- **DB・マイグレーションをリセットしない**
- **リモートからpullしない**

---

## Phase 0: デバッグログ削除（デプロイ前必須）

実装中に紛れ込んだデバッグ出力を検出して削除する。

```bash
# 検出（変更ファイルから抽出 — 既存ログは対象外）
git diff origin/main --name-only | xargs grep -nE "(console\.log|debugger|TODO: remove|FIXME: temp)" 2>/dev/null
```

**削除対象:**
- `console.log` / `debugger` ステートメント
- `TODO: remove` / `FIXME: temp` コメント
- 実装時に追加した一時的な確認ログ

**保持対象（消さない）:**
- `console.error` / `console.warn`（エラーログ）
- 既存のNestJS Loggerやpino等の正規ロガー出力
- ビジネスロジックに必要なログ

---

## Phase 1: ECRログイン

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
```

## Phase 2: Dockerイメージビルド（ARM64）

```bash
# Backend
cd nokoroa-backend && docker build --platform linux/arm64 -t nokoroa-backend .

# Frontend
cd nokoroa-frontend && docker build --platform linux/arm64 -t nokoroa-frontend .

# AI service (sidecar)
cd nokoroa-ai && docker build --platform linux/arm64 -t nokoroa-ai .
```

**注意:** frontendのlintエラーでビルドが失敗した場合は修正してから再ビルド。

### ビルド失敗時の修正ループ

```
ビルド失敗 → エラーログ確認 → 修正 → 再ビルド
    ↓（同一原因で3回失敗）
ユーザーへ報告（残エラー・試行差分・推奨アクション）
```

## Phase 3: ECRプッシュ

```bash
# Backend
docker tag nokoroa-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest

# Frontend
docker tag nokoroa-frontend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest

# AI sidecar
docker tag nokoroa-ai:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-ai:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-ai:latest
```

## Phase 4: ECSタスク定義更新

通常は `terraform apply` でTerraformが新リビジョンを登録する。手動更新する場合は以下を使用:

```bash
# Backend (backend + ai sidecar、2 コンテナ)
aws ecs describe-task-definition --task-definition nokoroa-prod-backend --region ap-northeast-1 --query 'taskDefinition' \
  | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
        | (.containerDefinitions[] | select(.name=="backend").image) = "<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"
        | (.containerDefinitions[] | select(.name=="ai").image) = "<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-ai:latest"' \
  > /tmp/backend-task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/backend-task-def.json --region ap-northeast-1

# Frontend
aws ecs describe-task-definition --task-definition nokoroa-prod-frontend --region ap-northeast-1 --query 'taskDefinition' \
  | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) | .containerDefinitions[0].image = "<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest"' \
  > /tmp/frontend-task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task-def.json --region ap-northeast-1
```

## Phase 5: ECSサービス更新

```bash
# 最新リビジョン番号を取得して更新
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-backend \
  --task-definition nokoroa-prod-backend --force-new-deployment --region ap-northeast-1

aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-frontend \
  --task-definition nokoroa-prod-frontend --force-new-deployment --region ap-northeast-1
```

## Phase 6: デプロイ確認

```bash
# サービス状態確認（running == desired になるまで繰り返す）
aws ecs describe-services --cluster nokoroa-prod-cluster \
  --services nokoroa-prod-backend nokoroa-prod-frontend \
  --region ap-northeast-1 \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,deployments:deployments[*].{status:status,running:runningCount,rollout:rolloutState}}'

# ログ確認
aws logs tail "/ecs/nokoroa-prod/backend" --since 5m --region ap-northeast-1
aws logs tail "/ecs/nokoroa-prod/frontend" --since 5m --region ap-northeast-1
```

---

## Phase 7: Go/No-Go 判定基準

以下を**順番に**確認し、全てpassで初めてデプロイ完了と判定する。

| 段階 | チェック | Goの条件 | No-Goの場合 |
|------|---------|---------|-------------|
| 1 | ECSサービス状態 | `runningCount == desiredCount` かつ `rolloutState == COMPLETED` | ロールバック検討 |
| 2 | ALBヘルスチェック | ターゲット全て `healthy` | タスクログ確認 |
| 3 | エンドポイント疎通 | Backend `/health` が 200 / Frontend `/` が 200 | 設定見直し |
| 4 | エラーログ | 過去5分の `ERROR` レベルが急増していない | 原因特定→ロールバック |

```bash
# 段階3の例
curl -sf https://api.nokoroa.example.com/health
curl -sfI https://nokoroa.example.com/ | head -1
```

---

## Phase 8: 完了報告テンプレート

```
## デプロイ完了報告

| Phase | 内容 | ステータス |
|-------|------|------|
| 0 | デバッグログ削除 | ✅ N件削除 |
| 1〜2 | ECRログイン・ARM64ビルド | ✅ |
| 3 | ECRプッシュ | ✅ backend / frontend |
| 4 | タスク定義更新 | ✅ rev:NNN |
| 5 | サービス更新 | ✅ force-new-deployment |
| 6 | サービス安定化 | ✅ running == desired |
| 7 | Go/No-Go判定 | ✅ 全項目pass |

**新リビジョン:** backend rev:N / frontend rev:N
**確認URL:** （本番エンドポイント）
**ロールバック手順:** タスク定義の前リビジョンを再指定して force-new-deployment
```

---

## 本番の停止・再開

**コスト削減が目的なら `/infra-teardown` と `/infra-rebuild` を使う。このスキルではない。**

| やりたいこと | 使うもの |
|---|---|
| 課金を止める（使わない期間） | **`/infra-teardown`** |
| 止めた環境を戻す | **`/infra-rebuild`** |
| 稼働中にコードを反映する | このスキルの Phase 1〜8 |

実体は Terraform の `runtime_enabled` 1 変数で、ALB・ECS・RDS・A レコードをまとめて落とす。
手順・落とし穴・サイクル変数の扱いは `terraform/README.md` の「停止と再開」にある。

```bash
cd terraform/envs/prod
terraform apply -var runtime_enabled=false   # 停止（最終スナップショットは自動取得）
terraform apply -var runtime_enabled=true    # 再開
```

素で叩かず `/infra-teardown` 経由にするのは、退避経路の確認（**config ではなく state を見る**）、
スナップショット名の衝突回避、削除待ち 30 日に入ると次の再開ができなくなるシークレットの除外、
引き継ぎ記録の作成を、このスキルが持っていないため。

### ⚠️ `--desired-count 0` は「停止」ではない

かつてここに desired count を 0 にする手順を載せていたが、**コスト削減にはならない**。

- 消えるのは Fargate のタスクだけで、**ALB と RDS は課金され続ける**
  （1 日 $2.70 のうち止まるのは約 $0.89。残り $1.3 前後 = 月 $40 前後が継続する）
- **最終スナップショットが取られない**ので、サイクル運用の前提が成立しない
- ECS サービス・タスク定義・ロググループは残るため、`runtime_enabled=false` との併用も意味がない

タスクだけ一時的に落としたい場合（デバッグ等）に限って使う。

```bash
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-backend --desired-count 0 --region ap-northeast-1
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-frontend --desired-count 0 --region ap-northeast-1
```

### 状態確認

```bash
aws ecs list-tasks --cluster nokoroa-prod-cluster --region ap-northeast-1
aws ecs describe-services --cluster nokoroa-prod-cluster \
  --services nokoroa-prod-backend nokoroa-prod-frontend \
  --region ap-northeast-1 \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}'
```

停止中はクラスタごと存在しないため、上のコマンドは `ClusterNotFoundException` になる。
これは異常ではなく「完全に停止できている」ことの確認になる。

---

## 既知の注意点

- **アーキテクチャ**: ECSタスク定義はARM64。`--platform linux/amd64` でビルドすると起動しない
- **フロントエンドヘルスチェック**: コンテナヘルスチェック（`curl -f http://localhost:3000/api/health`）は**存在する**。ALB のものと併用しており、除去はされていない
- **`HOSTNAME` を frontend のタスク定義に必ず入れる**: Next.js standalone の `server.js` は bind アドレスに `process.env.HOSTNAME` をそのまま使う。Fargate はコンテナの `HOSTNAME` をタスクの内部 DNS 名（`ip-10-0-1-217.ap-northeast-1.compute.internal`）で埋めるため、**Dockerfile の `ENV HOSTNAME="0.0.0.0"` は上書きされて効かない**。すると ENI の IP にしか bind されず `127.0.0.1` では待ち受けないので、**ALB のヘルスチェック（タスク IP 宛）は通るのにコンテナのヘルスチェック（localhost 宛）だけが必ず失敗し、タスクが 2 分ごとに kill され続ける**。サイトは一応見えるため気づきにくい。切り分けはログの bind 先を見るのが速い:

  ```bash
  aws logs tail /ecs/nokoroa-prod/frontend --region ap-northeast-1 --since 10m --format short | grep -E 'Local:|Network:'
  # 正常: http://0.0.0.0:3000 / 異常: http://ip-10-0-x-x.ap-northeast-1.compute.internal:3000
  ```

- **`ignore_changes = [task_definition]` のため Terraform の apply だけでは反映されない**: ECS サービスには `lifecycle { ignore_changes = [task_definition] }` が入っている。Terraform でタスク定義（環境変数・CPU/メモリ等）を変えると新リビジョンは登録されるが、**サービスは古いリビジョンを指したまま**になる。反映には明示的な更新が要る:

  ```bash
  aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-frontend \
    --task-definition nokoroa-prod-frontend:<新リビジョン> --region ap-northeast-1
  ```

- **force-new-deployment だけでは不十分**: タスク定義のイメージタグが古い場合、新リビジョンを登録してからサービスを更新する必要がある

---

## RAG (pgvector) 初回セットアップ

RAG機能のEmbeddingテーブルを使うには pgvector 拡張が必要。**初回のみ**以下の手順:

### 1. パラメータグループの確認は不要（`vector` のプリロードは要らない）

**`shared_preload_libraries` に `vector` を入れてはいけない。** pgvector は共有メモリもバックグラウンドワーカーも使わない通常の拡張で、プリロードせずに `CREATE EXTENSION vector;` だけで有効になる。RDS は許可リスト外の値を `ModifyDBParameterGroup` で拒否する（`InvalidParameterValue`）ため、指定すると**パラメータグループは作れるのに設定だけ失敗し、`terraform apply` が RDS の手前で止まる**。

許可される値は次のとおり（`vector` は含まれない）:

```
auto_explain, orafce, pgaudit, pglogical, pg_bigm, pg_cron, pg_hint_plan,
pg_prewarm, pg_similarity, pg_stat_statements, pg_tle, pg_transport,
plprofiler, plrust
```

### 2. RDS 再起動も不要

プリロードを変更しないので `pending-reboot` の反映待ちは発生しない。

### 3. CREATE EXTENSION 実行
RDS のマスターユーザーで実行（migration内では実行できないことがあるため）:
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Prisma マイグレーション実行
ECS task一回限りで実行 or ローカルからVPC接続して実行:
```bash
cd nokoroa-backend && npx prisma migrate deploy
```

### 5. backfill実行
既存投稿の埋め込み生成:
```bash
cd nokoroa-backend && npm run backfill:embeddings
# or 全件強制再生成: npm run backfill:embeddings -- --all
```

### 6. Secrets値設定（Terraform で空のまま作成された場合）
```bash
aws secretsmanager put-secret-value \
  --secret-id nokoroa-prod-gemini-api-key \
  --secret-string "$GEMINI_API_KEY" \
  --region ap-northeast-1
```
