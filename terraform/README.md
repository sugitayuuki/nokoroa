# Nokoroa Infrastructure - Terraform

Nokoroa の AWS インフラを Terraform で管理しています。

## 現在の状態

**本番環境は停止中です。** 個人開発のためコストを抑える目的で、常時課金が発生するリソース（ECS サービス・RDS・ALB）を削除しています。

ただし**インフラの定義はすべてこのディレクトリに残っています。** 空の state から `plan` を実行すると、この構成が定義しているリソースの全量が出ます。

```
$ terraform plan
Plan: 77 to add, 0 to change, 0 to destroy.
```

この 77 件は「停止によって削除された分」ではなく「定義されている全量」です。停止中も残しているリソース（下記）が state に載っていないため、現状の `plan` はそれらも新規作成として数えます。実際に再構築で作られるのは、それらを `import` で取り込んだあとの差分になります。

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

CI が毎コミットで `terraform fmt -check` / `init` / `validate` を実行しており、構文エラー・型の不整合・存在しない参照は検出されます。ただし `plan` は認証情報が必要なため CI では実行しておらず、**apply 時にしか現れない問題は検出できません**。プロバイダのバージョンは `.terraform.lock.hcl` をコミットして固定しているため、いつ誰が実行しても同じバージョンで解決されます。

### 停止中も残しているもの

消すと復旧が面倒なもの、削除待ち期間があるものは残しています（月 $2〜3 程度）。

| リソース | 理由 |
|---|---|
| Route 53 ホストゾーン | そもそも Terraform の管理対象外（`data` 参照）。削除するとネームサーバが変わりドメインが使えなくなる |
| ACM 証明書 | 無料。再発行には DNS 検証の待ち時間が必要 |
| ECR リポジトリ | ビルド済みイメージの保管場所 |
| S3 アップロードバケット | 投稿画像の実データ |
| Secrets Manager（2 件） | 削除すると 30 日間は同名で作り直せない。1 件あたり月 $0.40 |

## ディレクトリ構成

```
terraform/
├── modules/                  # 再利用可能なモジュール
│   ├── vpc/                  # VPC・3層サブネット（public/private/database）・SG
│   ├── rds/                  # PostgreSQL（pgvector 有効）
│   ├── ecs/                  # ECS Fargate（backend + AI サイドカー / frontend）
│   ├── alb/                  # Application Load Balancer・HTTPS リスナー
│   ├── s3/                   # 画像アップロード用バケット・state 保管用バケット + ロックテーブル
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

サブネットは public / private / database の 3 層に分けており、RDS は専用の database サブネットに置いています。外向き通信を必要としないため NAT がなくても問題ありません。

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

> **先に「既知の課題」を確認してください。** 停止中も AWS 上に残しているリソース（ECR・S3・Secrets Manager）は現在 state に載っておらず、この手順をそのまま実行すると名前の衝突で失敗します。先に `terraform import` での取り込みが必要です。

### 1. 変数ファイルを用意する

```bash
cd terraform/envs/prod
cp terraform.tfvars.example terraform.tfvars
```

`google_client_id` / `google_client_secret` / `gemini_api_key` の 3 つは既定値がなく、必須です。

`*_image` の 3 行は、`terraform.tfvars.example` にプレースホルダの文字列が入っています。イメージを push する前は**空文字にするかコメントアウトしてください**。プレースホルダのまま apply すると、存在しないレジストリを指すタスク定義が作られます。

### 2. インフラを作成する

```bash
terraform init
terraform apply
```

### 3. イメージをビルドして push する

タスク定義は 2 つです。backend タスクが `backend` と `ai` の 2 コンテナ（AI をサイドカーとして同居）、frontend タスクが 1 コンテナという構成です。backend コンテナは `ai` コンテナが healthy になるまで起動しないため、**AI イメージの push は必須**です。

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

以降のデプロイは GitHub Actions（`.github/workflows/deploy.yml`）が担います。backend・ai・frontend の 3 イメージを ARM64 でビルドして push し、ECS のサービスを更新します。

**現在は手動実行（`workflow_dispatch`）のみに設定しています。** 本番が停止していて ECS サービスが存在しないため、main への push で自動実行すると必ず失敗するからです。本番を再構築したら `push` トリガーを戻してください。

backend タスクは 1 つのタスク定義に `backend` と `ai` の 2 コンテナを持つため、**タスク定義のレンダリングを 2 段に連鎖させています**。1 回で済ませると、更新しなかった側のコンテナのイメージが古いまま残ります。

### 5. データベースをマイグレーションする

NAT を置かない構成のため、**パブリックサブネットを指定し `assignPublicIp=ENABLED` にします**。これを `DISABLED` にすると ECR や Secrets Manager に到達できず起動しません。

```bash
aws ecs run-task \
  --cluster nokoroa-prod-cluster \
  --task-definition nokoroa-prod-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[PUBLIC_SUBNET_ID],securityGroups=[ECS_SG_ID],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}'
```

サブネット ID とセキュリティグループ ID は `terraform output vpc_id` を起点に取得できます。

## 状態確認

```bash
# ECS サービスの状態
aws ecs describe-services --cluster nokoroa-prod-cluster --services nokoroa-prod-backend

# ログ（backend / frontend / ai の 3 つ）
aws logs tail /ecs/nokoroa-prod/backend --follow
```

## 停止するには

常時課金されるリソースを落とし、ドメインと成果物は残します。

**事前に削除保護を外す必要があります。** `envs/prod/main.tf` の `module "rds"` にある `deletion_protection = true` を `false` に変えて `terraform apply` してください。これを飛ばすと destroy は次の 2 つで失敗します。

- `Cannot delete protected DB Instance` — 削除保護が有効なため
- `final_snapshot_identifier is required` — `skip_final_snapshot = !deletion_protection` の式により、保護が有効だとスナップショット名が必須になるため

```bash
terraform destroy \
  -target=module.ecs \
  -target=module.alb \
  -target=module.rds \
  -target=module.vpc
```

**このコマンドは Secrets Manager も削除します。** `module.secrets` は `module.rds` に依存しているため、`-target=module.rds` を指定すると依存側として巻き込まれます。シークレットは `recovery_window_in_days` を明示していないため既定の 30 日間削除待ちに入り、**同じ名前での再作成が 30 日間できません**。短い間隔で停止と再構築を繰り返す場合は、`recovery_window_in_days = 0` を設定するか、停止対象をモジュール単位ではなくリソース単位で列挙してください。

## 既知の課題

- **state が S3 に置かれていない**: `versions.tf` の S3 backend がコメントアウトされたままで、state はローカル管理です。保管先のバケットと DynamoDB ロックテーブルは `modules/s3` に定義済みですが、state を置くバケット自身を同じ設定で作る循環があるため、ブートストラップを分ける必要があります。
- **残しているリソースが state に載っていない**: 上記の「停止中も残しているもの」は AWS 上に実在する一方、現在の state には記録されていません。このため今のまま `terraform apply` を実行すると、ECR・S3・Secrets Manager が既存と衝突します。再構築の前に `terraform import` で state に取り込む必要があります。
- **変数の `validation` が未設定**: 89 個の変数すべてに `description` と `type` はありますが、値域の検証は入れていません。
