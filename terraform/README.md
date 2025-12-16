# Nokoroa Infrastructure - Terraform

NokoroaアプリケーションのAWSインフラをTerraformで管理します。

## 前提条件

- AWS CLIがインストール・設定済み
- Terraform v1.5以上がインストール済み
- Dockerがインストール済み
- ドメインがRoute 53で管理されている
- Google OAuthの認証情報を取得済み

### 1. 環境変数ファイルの作成

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集：
```hcl
backend_image  = ""
frontend_image = ""
google_client_id     = "YOUR_GOOGLE_CLIENT_ID"
google_client_secret = "YOUR_GOOGLE_CLIENT_SECRET"
```

### 2. インフラの作成

```bash
terraform init
terraform apply
```

### 3. Dockerイメージのビルド・プッシュ

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $(terraform output -raw ecr_backend_repository_url | cut -d'/' -f1)

# バックエンド
cd ../nokoroa-backend
docker build --platform linux/amd64 -t nokoroa-backend .
docker tag nokoroa-backend:latest $(cd ../terraform && terraform output -raw ecr_backend_repository_url):latest
docker push $(cd ../terraform && terraform output -raw ecr_backend_repository_url):latest

# フロントエンド
cd ../nokoroa-frontend
docker build --platform linux/amd64 -t nokoroa-frontend .
docker tag nokoroa-frontend:latest $(cd ../terraform && terraform output -raw ecr_frontend_repository_url):latest
docker push $(cd ../terraform && terraform output -raw ecr_frontend_repository_url):latest
```

### 4. terraform.tfvarsを更新してECSを起動

```hcl
backend_image  = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"
frontend_image = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest"
```

```bash
terraform apply
```

### 5. データベースのマイグレーション

```bash
aws ecs run-task \
  --cluster nokoroa-prod-cluster \
  --task-definition nokoroa-prod-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[SUBNET_ID],securityGroups=[SG_ID],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}'
```

## 確認コマンド

```bash
# ECSサービスの状態
aws ecs describe-services --cluster nokoroa-prod-cluster --services nokoroa-prod-backend-service

# ログ確認
aws logs tail /ecs/nokoroa-prod-backend --follow
```

