---
name: nokoroa-deploy
description: "Nokoroa本番デプロイ（DockerイメージビルドARM64→ECRプッシュ→ECSタスク定義更新→サービス再デプロイ→ヘルスチェック確認）。Use when: (1) 本番にデプロイしたい、(2)「デプロイして」「本番反映して」「ECSにプッシュして」と指示された場合、(3) ECSの起動・停止を操作したい場合"
---

# Nokoroa Deploy — AWS ECS デプロイ

## 前提条件

- AWS CLIがインストール・認証済み（`aws sts get-caller-identity` で確認）
- Dockerが起動済み
- ECRリポジトリ: `<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend` / `nokoroa-frontend`
- ECSクラスター: `nokoroa-prod-cluster`
- **アーキテクチャ: ARM64（Graviton）** — 必ず `--platform linux/arm64` でビルドすること

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
```

**注意:** frontendのlintエラーでビルドが失敗した場合は修正してから再ビルド。

## Phase 3: ECRプッシュ

```bash
# Backend
docker tag nokoroa-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest

# Frontend
docker tag nokoroa-frontend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest
```

## Phase 4: ECSタスク定義更新

現在のタスク定義を取得し、イメージを `:latest` に更新して新リビジョンを登録:

```bash
# Backend
aws ecs describe-task-definition --task-definition nokoroa-prod-backend --region ap-northeast-1 --query 'taskDefinition' \
  | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) | .containerDefinitions[0].image = "<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"' \
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

## ECS起動・停止

### 起動（desired count を 1 に）

```bash
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-backend --desired-count 1 --force-new-deployment --region ap-northeast-1
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-frontend --desired-count 1 --force-new-deployment --region ap-northeast-1
```

### 停止（desired count を 0 に）

```bash
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-backend --desired-count 0 --region ap-northeast-1
aws ecs update-service --cluster nokoroa-prod-cluster --service nokoroa-prod-frontend --desired-count 0 --region ap-northeast-1
```

### 停止確認

```bash
aws ecs list-tasks --cluster nokoroa-prod-cluster --region ap-northeast-1
aws ecs describe-services --cluster nokoroa-prod-cluster \
  --services nokoroa-prod-backend nokoroa-prod-frontend \
  --region ap-northeast-1 \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}'
```

---

## 既知の注意点

- **アーキテクチャ**: ECSタスク定義はARM64。`--platform linux/amd64` でビルドすると起動しない
- **フロントエンドヘルスチェック**: コンテナヘルスチェックは除去済み（ALBヘルスチェックのみ使用）
- **force-new-deployment だけでは不十分**: タスク定義のイメージタグが古い場合、新リビジョンを登録してからサービスを更新する必要がある
