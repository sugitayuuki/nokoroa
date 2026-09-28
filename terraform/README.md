# Nokoroa Infrastructure - Terraform

Nokoroa の AWS インフラを Terraform で管理しています。

## 現在の状態

**本番環境は停止中です。** 個人開発のためコストを抑える目的で、常時課金が発生するリソース（ECS サービス・RDS・ALB）を削除しています。

ただし**インフラの定義はすべてこのディレクトリに残っています。** 削除したリソースは以下のとおり `plan` に現れ、`apply` で再構築できます。

```
$ terraform plan
Plan: 77 to add, 0 to change, 0 to destroy.
```

| モジュール | 作成されるリソース数 |
|---|---:|
| `modules/secrets` | 17 |
| `modules/vpc` | 14 |
| `modules/ecs` | 13 |
| `envs/prod`（ECR・ACM・Route53 等） | 13 |
| `modules/s3` | 11 |
| `modules/alb` | 6 |
| `modules/rds` | 3 |
| **合計** | **77** |

この定義が壊れていないことは CI が毎コミット検証しています（`terraform fmt -check` / `init` / `validate`）。プロバイダのバージョンは `.terraform.lock.hcl` をコミットして固定しているため、いつ誰が実行しても同じバージョンで解決されます。

### 停止中も残しているもの

ドメインと成果物は消すと復旧が面倒なため、意図的に残しています（月 $2〜3 程度）。

| リソース | 理由 |
|---|---|
| Route 53 ホストゾーン | 削除するとネームサーバが変わりドメインが使えなくなる |
| ACM 証明書 | 無料。再発行には DNS 検証の待ち時間が必要 |
| ECR リポジトリ | ビルド済みイメージの保管場所 |
| S3 アップロードバケット | 投稿画像の実データ |

## ディレクトリ構成

```
terraform/
├── modules/                  # 再利用可能なモジュール
│   ├── vpc/                  # VPC・サブネット・ルーティング・セキュリティグループ
│   ├── rds/                  # PostgreSQL（pgvector 有効）
│   ├── ecs/                  # ECS Fargate（backend / frontend / AI サイドカー）
│   ├── alb/                  # Application Load Balancer・HTTPS リスナー
│   ├── s3/                   # 画像アップロード用バケット・state 保管用バケット
│   └── secrets/              # AWS Secrets Manager
├── envs/
│   ├── prod/                 # 本番環境（実装済み）
│   │   ├── main.tf           # モジュール呼び出し・ECR・ACM・Route 53
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   ├── .terraform.lock.hcl
│   │   ├── terraform.tfvars.example
│   │   └── terraform.tfvars  # ※ gitignore 対象
│   ├── stg/                  # 未実装（方針メモのみ）
│   └── dev/                  # 未実装（方針メモのみ）
└── README.md
```

ECR リポジトリとセキュリティグループは専用モジュールを作らず、前者は `envs/prod/main.tf`、後者は `modules/vpc` の中に置いています。どちらも環境をまたいで再利用する見込みが薄く、切り出すと参照が増えるだけと判断しました。

## 設計上の判断

### NAT Gateway を使わない

ECS タスクはプライベートサブネットではなく**パブリックサブネットに配置し、パブリック IP を付与しています**（`enable_nat_gateway = false`）。NAT Gateway は 1 台あたり月 $32 ほどかかり、個人開発の規模では ECS タスク本体より高くつくためです。

パブリック IP は付きますが、ECS のセキュリティグループは **ALB のセキュリティグループからの通信だけを許可**しているため、インターネットから直接到達することはできません。

```
インターネット → ALB        (80 / 443 のみ開放)
ALB SG        → ECS タスク  (SG 参照。CIDR では開けない)
ECS SG        → RDS         (5432。SG 参照)
```

RDS はプライベートサブネットに置いており、外向き通信を必要としないため NAT がなくても問題ありません。

### Secrets Manager を使う

DB パスワード・JWT シークレット・OAuth クライアントシークレット・Gemini API キーは AWS Secrets Manager に保存し、ECS タスク定義からは ARN 参照で注入しています。DB パスワードは `random_password` で生成しており、平文でリポジトリにも tfvars にも現れません。

## 前提条件

- AWS CLI が設定済み
- Terraform v1.5 以上
- Docker
- ドメインが Route 53 で管理されている
- Google OAuth のクライアント ID / シークレットを取得済み
- Gemini API キーを取得済み

## 再構築の手順

イメージが存在しない状態から始めるため、**`apply` を 2 回に分けます**。1 回目で ECR を含むインフラを作り、イメージを push してから 2 回目でコンテナを起動します。

### 1. 変数ファイルを用意する

```bash
cd terraform/envs/prod
cp terraform.tfvars.example terraform.tfvars
```

`google_client_id` / `google_client_secret` / `gemini_api_key` の 3 つは既定値がなく、必須です。`*_image` は初回は空のままで構いません。

### 2. インフラを作成する

```bash
terraform init
terraform apply
```

### 3. イメージをビルドして push する

ECS タスクは backend・frontend・AI の 3 コンテナ構成です。backend は AI コンテナが healthy になるまで起動しないため、**AI イメージの push は必須**です。

```bash
REGION=ap-northeast-1
REGISTRY=$(terraform output -raw ecr_backend_repository_url | cut -d/ -f1)
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

for svc in backend frontend ai; do
  URL=$(terraform output -raw "ecr_${svc}_repository_url")
  docker build --platform linux/arm64 -t "$URL:latest" "../../../nokoroa-${svc}"
  docker push "$URL:latest"
done
```

ECS タスクは ARM64（Fargate Graviton）で動くため、`--platform linux/arm64` を指定します。

### 4. イメージを指定して再度 apply する

`terraform.tfvars` に push したイメージの URL を書いて適用します。

```hcl
backend_image  = "<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-backend:latest"
frontend_image = "<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-frontend:latest"
ai_image       = "<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/nokoroa-ai:latest"
```

```bash
terraform apply
```

以降のデプロイは GitHub Actions（`.github/workflows/deploy.yml`）が 3 イメージのビルドとタスク定義の更新を行います。

### 5. データベースをマイグレーションする

```bash
aws ecs run-task \
  --cluster nokoroa-prod-cluster \
  --task-definition nokoroa-prod-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[SUBNET_ID],securityGroups=[SG_ID],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}'
```

## 状態確認

```bash
# ECS サービスの状態
aws ecs describe-services --cluster nokoroa-prod-cluster --services nokoroa-prod-backend-service

# ログ
aws logs tail /ecs/nokoroa-prod-backend --follow
```

## 停止するには

常時課金されるリソースだけを落とし、ドメインと成果物は残します。

```bash
terraform destroy \
  -target=module.ecs \
  -target=module.alb \
  -target=module.rds \
  -target=module.vpc
```

## 既知の課題

- **state が S3 に置かれていない**: `versions.tf` の S3 backend がコメントアウトされたままで、state はローカル管理です。保管先のバケットと DynamoDB ロックテーブルは `modules/s3` に定義済みですが、state を置くバケット自身を同じ設定で作る循環があるため、ブートストラップを分ける必要があります。
- **残しているリソースが state に載っていない**: 上記の「停止中も残しているもの」は AWS 上に実在する一方、現在の state には記録されていません。このため今のまま `terraform apply` を実行すると、ECR・S3・Secrets Manager が既存と衝突します。再構築の前に `terraform import` で state に取り込む必要があります。
- **変数の `validation` が未設定**: 89 個の変数すべてに `description` と `type` はありますが、値域の検証は入れていません。
