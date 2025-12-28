# Nokoroa Infrastructure - Terraform

NokoroaアプリケーションのAWSインフラをTerraformで管理します。

## ディレクトリ構成

```
terraform/
├── modules/                    # 再利用可能なTerraformモジュール
│   ├── vpc/                   # VPCとネットワーク
│   ├── ecs/                   # ECS Fargate
│   ├── ecr/                   # ECRレジストリ
│   ├── rds/                   # PostgreSQLデータベース
│   ├── alb/                   # Application Load Balancer
│   ├── s3/                    # S3バケット
│   ├── security_groups/       # セキュリティグループ
│   ├── secrets/               # SSM Parameter Store
├── envs/                       # 環境別設定
│   ├── prod/                  # 本番環境
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   ├── terraform.tfvars.example
│   │   └── terraform.tfvars   # ※gitignore対象
│   ├── stg/                   # ステージング環境
│   └── dev/                   # 開発環境
└── README.md
```

## 前提条件

- AWS CLIがインストール・設定済み
- Terraform v1.5以上がインストール済み
- Dockerがインストール済み
- ドメインがRoute 53で管理されている
- Google OAuthの認証情報を取得済み

## セットアップ

### 1. 環境変数ファイルの作成

```bash
cd terraform/envs/prod
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
cd terraform/envs/prod
terraform init
terraform apply
```

### 3. Dockerイメージのビルド・プッシュ

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $(terraform output -raw ecr_backend_repository_url | cut -d'/' -f1)

# バックエンド
cd ../../../nokoroa-backend
docker build --platform linux/amd64 -t nokoroa-backend .
docker tag nokoroa-backend:latest $(cd ../terraform/envs/prod && terraform output -raw ecr_backend_repository_url):latest
docker push $(cd ../terraform/envs/prod && terraform output -raw ecr_backend_repository_url):latest

# フロントエンド
cd ../nokoroa-frontend
docker build --platform linux/amd64 -t nokoroa-frontend .
docker tag nokoroa-frontend:latest $(cd ../terraform/envs/prod && terraform output -raw ecr_frontend_repository_url):latest
docker push $(cd ../terraform/envs/prod && terraform output -raw ecr_frontend_repository_url):latest
```

### 4. terraform.tfvarsを更新してECSを起動

```hcl
backend_image  = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"
frontend_image = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest"
```

```bash
cd terraform/envs/prod
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
