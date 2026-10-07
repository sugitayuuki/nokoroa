# Nokoroa Infrastructure - Terraform

Nokoroa の AWS インフラを Terraform で管理しています。

## 現在の状態

**本番環境は停止中です。** 個人開発のためコストを抑える目的で、常時課金が発生するリソース（ECS サービス・RDS・ALB）を削除しています。

稼働と停止は **`runtime_enabled` 変数ひとつ**で切り替えます。手順・所要時間・月額は「[停止と再開](#停止と再開)」を参照してください。

ただし**インフラの定義はすべてこのディレクトリに残っています。** 空の state から `plan` を実行すると、この構成が定義しているリソースの全量が出ます。

```
$ terraform plan -var runtime_enabled=true
Plan: 79 to add, 0 to change, 0 to destroy.
```

この 79 件は「停止によって削除された分」ではなく「`runtime_enabled = true` で定義されている全量」です。停止中も残しているリソース（下記）が state に載っていないため、現状の `plan` はそれらも新規作成として数えます。実際に再構築で作られるのは、それらを `import` で取り込んだあとの差分になります。

| モジュール | 作成されるリソース数 |
|---|---:|
| `modules/secrets` | 17 |
| `modules/vpc` | 14 |
| `modules/ecs` | 13 |
| `envs/prod`（ECR・ACM・Route53 等） | 13 |
| `modules/s3` | 11 |
| `modules/alb` | 8 |
| `modules/rds` | 3 |
| **合計** | **79** |

CI が毎コミットで `terraform fmt -check` / `init` / `validate` を実行しており、構文エラー・型の不整合・存在しない参照は検出されます。ただし `plan` は認証情報が必要なため CI では実行しておらず、**apply 時にしか現れない問題は検出できません**。プロバイダのバージョンは `.terraform.lock.hcl` をコミットして固定しているため、いつ誰が実行しても同じバージョンで解決されます。

### 停止中も残しているもの

消すと復旧が面倒なもの、削除待ち期間があるものは残しています（**月 $5〜6 程度**）。`runtime_enabled` に `count` を付けていないリソースがこれに該当します。

| リソース | 月額 | 理由 |
|---|---:|---|
| Route 53 ホストゾーン | $0.50 | そもそも Terraform の管理対象外（`data` 参照）。削除するとネームサーバが変わりドメインが使えなくなる |
| ACM 証明書 | $0 | 無料。再発行には DNS 検証の待ち時間が必要 |
| ECR リポジトリ | 約 $1 | ビルド済みイメージの保管場所（3 リポジトリ × 最大 10 世代） |
| S3 バケット | 約 $1 | 投稿画像の実データと state 保管先 |
| Secrets Manager | $2.80 | 削除すると 30 日間は同名で作り直せない。1 件 $0.40 × 7 件（下記参照） |
| RDS スナップショット | 約 $0.30 | 停止時の最終スナップショット。これが次回の再開時のデータ源になる |
| VPC・サブネット・SG・IGW | $0 | NAT を置いていないため無料。消す理由がない |

`module "secrets"` に `count` を付けていないのは意図的です。destroy すると `recovery_window_in_days` 既定の 30 日間削除待ちに入り、**同名のシークレットを 30 日間作り直せない = 次の再開ができなくなる**ためです。月 $2.80 を払って残す方が安く済みます。

`modules/secrets` が定義しているシークレットは **7 件**です（`db-password`(現在アプリからは未消費。接続は `database-url` を使用) / `jwt-secret` / `database-url` / `google-client-id` / `google-client-secret` / `gemini-api-key` / `internal-api-key`）。**過去の停止（`-target=module.rds` を指定した destroy）は、依存側としてこの 7 件を巻き込んで削除しました。** `recovery_window_in_days` を明示していないため既定の **30 日間の削除待ち**に入り、待機中も課金対象として残ります。請求上「2 件分」しか見えていないのは、残りが削除待ち期間を終えて消えた後の状態と考えられます（AWS 上の実数は未確認）。`runtime_enabled` を導入した現在はシークレットを destroy 対象に含めないため、この巻き込みは再発しません。

つまり再構築時は、**AWS に実在する分は `terraform import` が必要、削除待ちが残っている分は待機満了か `aws secretsmanager restore-secret` が必要**です。どちらに該当するかは事前に確認してください。

```bash
# 実在（削除待ちを含む）するシークレットの一覧と削除予定日
aws secretsmanager list-secrets \
  --include-planned-deletion \
  --query 'SecretList[?starts_with(Name, `nokoroa-prod-`)].[Name,DeletedDate]' \
  --output table
```

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
ALB SG        → ECS タスク  (3000 / 3001 のみ。SG 参照。CIDR では開けない)
ECS SG        → RDS         (5432。SG 参照)
```

ECS 側の受け口はフロントエンド（3000）とバックエンド（3001）の 2 ポートだけに絞っています（`modules/vpc` の `frontend_port` / `backend_port`）。

サブネットは public / private / database の 3 層に分けており、RDS は専用の database サブネットに置いています。外向き通信を必要としないため NAT がなくても問題ありません。

### ドメインは apex（`nokoroa.com`）に寄せる

`www.nokoroa.com` にも A レコードと ACM の SAN がありますが、バックエンドの CORS 許可オリジンは apex 単独です。www のまま到達すると API がすべて CORS で失敗するため、**ALB の HTTPS リスナールール（優先度 150）で www → apex へ 301 リダイレクト**しています（`modules/alb` の `apex_domain`）。優先度は意図的に `/api/*` の転送ルール（100）より**後**にしています。ALB の redirect は 301/302 しか選べず、www 宛の `POST /api/*` を先にリダイレクトすると GET に降格してボディが消えるため、API は www のままでも転送し、ページ遷移（GET）だけを apex へ寄せる設計です。HTTP リスナー側にも同じルール（優先度 10）を置き、`http://www` からの 301 が 2 ホップになるのを避けています。

ポート 80 のリスナーは `enable_https` で排他にしています。HTTPS 有効時は 443 へ 301 する `http`、無効時は frontend へ直接転送する `http_dev` のどちらか一方だけが作られます（両方に `count` を入れる前は同じ 80 番を取り合って `DuplicateListener` になり、かつ 443 が無いのに 443 へリダイレクトする分岐が残っていました）。

ドメイン名は `envs/prod` の `app_domain`（既定 `nokoroa.com`）に一本化し、Route 53・ACM・S3 の CORS・ECS の `FRONTEND_URL` / `GOOGLE_CALLBACK_URL` がこれを参照します。

フロントエンドの `NEXT_PUBLIC_API_URL` は **ECS のタスク定義には持たせていません**。Next.js は `NEXT_PUBLIC_*` をビルド時にバンドルへ埋め込むため、ランタイムの環境変数では上書きできないからです。値の指定は `.github/workflows/deploy.yml` のビルド引数に一本化しています。

HTTPS リスナーの TLS ポリシーは TLS 1.3 に対応した `ELBSecurityPolicy-TLS13-1-2-2021-06` を使っています。

### データベースのログは絞る

`log_statement = all` は全 SQL をパラメータごと CloudWatch Logs へ流すため、ログ課金・書き込み負荷・個人情報の残留という 3 つの問題があります。スキーマ変更の監査だけ残す `log_statement = ddl` とし、性能調査は `log_min_duration_statement = 1000`（1 秒以上のクエリのみ）で代替しています。

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

terraform apply \
  -var runtime_enabled=true \
  -var db_final_snapshot_identifier="nokoroa-prod-$(date +%Y%m%d-%H%M)"
```

`db_final_snapshot_identifier` は**停止時に作るスナップショットの名前**で、起動時に渡しておく必要があります（理由は「[停止と再開](#停止と再開)」）。初回は復元元が無いため `db_snapshot_identifier` は指定しません（空の DB で起動します）。

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
terraform apply \
  -var runtime_enabled=true \
  -var db_final_snapshot_identifier="<1 回目と同じ値>"
```

> `runtime_enabled` には既定値がありません。付け忘れると Terraform が入力を促して止まります（黙って何かを壊すより良い、という設計です）。`db_final_snapshot_identifier` を 1 回目と変えると plan に差分が 1 行出ますが、API 呼び出しは発生しません。

以降のデプロイは GitHub Actions（`.github/workflows/deploy.yml`）が担います。backend・ai・frontend の 3 イメージを ARM64 でビルドして push し、ECS のサービスを更新します。

**現在は手動実行（`workflow_dispatch`）のみに設定しています。** 本番が停止していて ECS サービスが存在しないため、main への push で自動実行すると必ず失敗するからです。本番を再構築したら `push` トリガーを戻してください。

backend タスクは 1 つのタスク定義に `backend` と `ai` の 2 コンテナを持つため、**タスク定義のレンダリングを 2 段に連鎖させています**。1 回で済ませると、更新しなかった側のコンテナのイメージが古いまま残ります。

デプロイが登録する `:sha` タグ付きのタスク定義と Terraform が管理するタスク定義は常に食い違うため、**ECS サービスには `lifecycle { ignore_changes = [task_definition] }` を入れています**。これがないと次の `apply` で稼働中のイメージが古いリビジョンへ巻き戻ります。裏返しとして、タスク定義そのもの（環境変数・CPU/メモリ等）を Terraform で変更した場合は、サービスへ反映するためにデプロイを流すか `aws ecs update-service --task-definition <新リビジョン>` を実行してください。

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

## 停止と再開

面談やデモの前に立ち上げ、終わったら落とす運用を想定しています。切り替えは `runtime_enabled` ひとつで、`-target` も手でのコード書き換えも不要です。

### 月額とサイクル単価

| 状態 | 内容 | 金額 |
|---|---|---:|
| 停止中 | Secrets $2.80 + Route 53 $0.50 + ECR 約 $1 + S3 約 $1 + スナップショット約 $0.30 | **月 $5〜6** |
| 稼働中（24 時間） | ALB $0.65 + Fargate $0.89 + RDS $0.69 + パブリック IPv4 $0.48 | **1 回 $2.70** |
| 常時稼働した場合 | 上記 + CloudWatch・データ転送 | 月 $95〜130 |

価格は AWS Price List API の `ap-northeast-1` 実値（2026-10 時点）に基づく概算です。Fargate は ARM64 単価（$0.04045/vCPU 時・$0.00442/GB 時）、RDS は `db.t4g.micro` Single-AZ（$0.025/時）+ gp3 20GB（$0.138/GB 月）で計算しています。

### 停止する

```bash
terraform apply -var runtime_enabled=false
```

消えるのは ALB・ECS（クラスタ・サービス・タスク定義・IAM ロール・ロググループ）・RDS インスタンス・apex と www の A レコードです。RDS は `db_final_snapshot_identifier` で指定した名前の最終スナップショットを作ってから削除されます。所要時間は ALB と ECS が即時、RDS のスナップショット作成が 5〜10 分です。

**停止すると CloudWatch のログ履歴が失われます。** `modules/ecs` がロググループ 3 種（backend / frontend / ai）を抱えているため、モジュールごと消えると過去のログも消えます。保持期間は 30 日設定でデモ環境のログ履歴に価値が薄いと判断して分割しませんでした。残したい場合はロググループを `runtime_enabled` の外側へ切り出してください。

### 再開する

```bash
# 直前の停止で作られたスナップショット名を確認する
aws rds describe-db-snapshots \
  --snapshot-type manual \
  --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))[:5].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table

terraform apply \
  -var runtime_enabled=true \
  -var db_snapshot_identifier="<上で確認した名前>" \
  -var db_final_snapshot_identifier="nokoroa-prod-$(date +%Y%m%d-%H%M)"
```

所要時間の目安は **合計 25〜35 分**です。

| 工程 | 時間 |
|---|---|
| RDS スナップショットからの復元 | 10〜20 分 |
| ALB 作成 | 3〜5 分 |
| ECS タスク起動 + ヘルスチェック通過 | 2〜3 分 |

ACM 証明書と DNS 検証レコードは停止しても残しているため、**証明書の再発行と DNS 検証の待ち時間は発生しません**。A レコードは Route 53 のエイリアスなので、作成後ほぼ即時に引けるようになります。面談の 30 分前ではなく前日に立てることを勧めます。

`db_snapshot_identifier` を省くと**空の DB で起動します**。意図的に初期化したいとき以外は必ず指定してください。デモデータを入れ直す場合は `nokoroa-backend/prisma/seed.ts` を使います。

### 設計上の注意点

**`db_final_snapshot_identifier` は停止時ではなく起動時に渡す。** Terraform は破棄するリソースの属性を **state から** 読むため、`terraform apply -var runtime_enabled=false -var db_final_snapshot_identifier=...` のように停止と同時に渡しても無視されます。インスタンスが存在するうちの apply で state に入れておく必要があります。`modules/rds` の `lifecycle.precondition` が、スナップショット名なしの起動（= 停止時にデータを失う構成）を apply の時点で弾きます。

**スナップショット名はサイクルごとに一意にする。** 同名のスナップショットは 2 つ作れないため、前回と同じ名前のまま停止すると destroy が失敗します。上のコマンド例では `$(date +%Y%m%d-%H%M)` を付けています。`timestamp()` で自動生成しないのは、毎回値が変わって plan に差分が出続け「変更なし」を確認できなくなるためです。

**削除保護は使っていません。** 以前は `deletion_protection = true` で、停止のたびに手でコードを `false` へ書き換えて apply する必要があり、その書き換え忘れで destroy が失敗していました。データは最終スナップショットで守る方針に変え、停止を 1 変数で完結させています。代償として、誤って `runtime_enabled=false` を apply したときに AWS 側の保護は働きません（スナップショットは作られるので復元は可能です）。

**`runtime_enabled` を `terraform.tfvars` に書かないこと。** `true` で固定すると素の `terraform apply` が課金を開始し、`false` で固定すると稼働中の本番を落とします。既定値を持たせていないのも同じ理由です。

## 既知の課題

- **state が S3 に置かれていない**: `versions.tf` の S3 backend がコメントアウトされたままで、state はローカル管理です。保管先のバケットと DynamoDB ロックテーブルは `modules/s3` に定義済みですが、state を置くバケット自身を同じ設定で作る循環があるため、ブートストラップを分ける必要があります。
- **残しているリソースが state に載っていない**: 上記の「停止中も残しているもの」は AWS 上に実在する一方、現在の state には記録されていません。このため今のまま `terraform apply` を実行すると、ECR・S3・Secrets Manager が既存と衝突します。再構築の前に `terraform import` で state に取り込む必要があります。Secrets Manager は削除待ち中のものが混ざりうるため、`import` の前に `list-secrets --include-planned-deletion` で状態を確認してください（削除待ちのものは `import` できず、`restore-secret` か待機満了が必要です）。
- **変数の `validation` が未設定**: 94 個の変数すべてに `description` と `type` はありますが、値域の検証は入れていません。
