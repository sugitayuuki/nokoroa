# Nokoroa Infrastructure with Terraform

このディレクトリにはNokoroaアプリケーションのAWSインフラストラクチャをTerraformで管理するための設定が含まれています。

## 構成要素

- **VPC**: パブリック/プライベート/データベースサブネット
- **RDS**: PostgreSQLデータベース
- **ECS/Fargate**: バックエンドとフロントエンドのコンテナ
- **ALB**: Application Load Balancer
- **S3**: アップロードファイル用ストレージ

## ディレクトリ構造

```
terraform/
├── modules/           # 再利用可能なTerraformモジュール
│   ├── vpc/          # VPCとネットワーク設定
│   ├── rds/          # RDS PostgreSQL設定
│   ├── ecs/          # ECS/Fargate設定
│   ├── alb/          # Application Load Balancer設定
│   └── s3/           # S3バケット設定
├── environments/      # 環境別の設定
│   ├── dev/          # 開発環境
│   ├── staging/      # ステージング環境
│   └── prod/         # 本番環境
├── main.tf           # メインのTerraform設定
├── variables.tf      # 変数定義
├── outputs.tf        # 出力定義
└── versions.tf       # Terraformとプロバイダーのバージョン管理
```

## 前提条件

1. AWS CLIがインストールされ、設定されていること
2. Terraform 1.5以上がインストールされていること
3. AWS認証情報が設定されていること

## セットアップ

### 1. AWS認証の設定

```bash
aws configure
```

### 2. Terraformの初期化

```bash
cd terraform
terraform init
```

### 3. 環境変数の設定

`environments/dev/terraform.tfvars`ファイルを編集し、必要な値を設定します：

```hcl
db_password = "your-secure-password"
jwt_secret = "your-jwt-secret"
```

**注意**: 本番環境では、機密情報をAWS Secrets ManagerやParameter Storeで管理することを推奨します。

### 4. インフラストラクチャのプラン確認

```bash
terraform plan -var-file=environments/dev/terraform.tfvars
```

### 5. インフラストラクチャの作成

```bash
terraform apply -var-file=environments/dev/terraform.tfvars
```

## Dockerイメージの準備

ECSで実行するには、DockerイメージをECRにプッシュする必要があります：

### 1. ECRリポジトリの作成

```bash
aws ecr create-repository --repository-name nokoroa-backend --region ap-northeast-1
aws ecr create-repository --repository-name nokoroa-frontend --region ap-northeast-1
```

### 2. Dockerイメージのビルドとプッシュ

```bash
# バックエンド
cd ../nokoroa-backend
docker build -t nokoroa-backend .
docker tag nokoroa-backend:latest [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest
docker push [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest

# フロントエンド
cd ../nokoroa-frontend
docker build -t nokoroa-frontend .
docker tag nokoroa-frontend:latest [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest
docker push [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest
```

### 3. terraform.tfvarsを更新

```hcl
backend_image  = "[AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"
frontend_image = "[AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest"
```

## 状態管理

Terraformの状態ファイルをS3に保存する場合は、`versions.tf`のbackend設定のコメントを解除します：

```hcl
backend "s3" {
  bucket         = "nokoroa-terraform-state"
  key            = "terraform.tfstate"
  region         = "ap-northeast-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

## SSL/TLS証明書の設定

HTTPSを有効にするには、AWS Certificate Manager (ACM)で証明書を作成し、ARNを設定します：

```hcl
# main.tfのalbモジュール内
certificate_arn = "arn:aws:acm:ap-northeast-1:xxxxx:certificate/xxxxx"
```

## クリーンアップ

インフラストラクチャを削除する場合：

```bash
terraform destroy -var-file=environments/dev/terraform.tfvars
```

## トラブルシューティング

### RDS接続エラー
- セキュリティグループの設定を確認
- データベースのユーザー名とパスワードを確認

### ECSタスクが起動しない
- CloudWatch Logsでコンテナログを確認
- タスク定義のメモリ/CPU設定を確認
- Dockerイメージが正しくプッシュされているか確認

### ALBヘルスチェックが失敗する
- ターゲットグループのヘルスチェック設定を確認
- アプリケーションのヘルスチェックエンドポイントを確認

## セキュリティの考慮事項

1. **機密情報の管理**: AWS Secrets ManagerまたはParameter Storeを使用
2. **最小権限の原則**: IAMロールとポリシーを適切に設定
3. **ネットワークセキュリティ**: 必要最小限のポートのみを開放
4. **暗号化**: RDSとS3の暗号化を有効化
5. **監査ログ**: CloudTrailとVPC Flow Logsを有効化