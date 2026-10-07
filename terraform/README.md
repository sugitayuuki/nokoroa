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

この 79 件は「停止によって削除された分」ではなく「`runtime_enabled = true` で定義されている全量」です。AWS 上に実在するのに state に載っていないリソース（下記）があるため、現状の `plan` はそれらも新規作成として数えます。実際に再構築で作られるのは、それらを `import` で取り込んだあとの差分になります。

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

### `runtime_enabled = false` で残るもの

停止しても destroy 対象にしないリソースです（`count` を付けていないもの）。定常運用に入ったあとの停止中コストは **月 $5〜6** になります。

| リソース | 月額 | 理由 |
|---|---:|---|
| Route 53 ホストゾーン | $0.50 | そもそも Terraform の管理対象外（`data` 参照）。削除するとネームサーバが変わりドメインが使えなくなる |
| ACM 証明書 | $0 | 無料。再発行には DNS 検証の待ち時間が必要 |
| ECR リポジトリ | 約 $1 | ビルド済みイメージの保管場所（3 リポジトリ × 最大 10 世代） |
| S3 バケット | 約 $1 | 投稿画像の実データ。state 用バケットも作るが backend は未設定（「既知の課題」参照） |
| Secrets Manager | $2.80 | 削除すると 30 日間は同名で作り直せない。1 件 $0.40 × 7 件（下記参照） |
| RDS スナップショット | 約 $0.30 | 停止時の最終スナップショット。次回の再開時のデータ源になる |
| VPC・サブネット・SG・IGW | $0 | NAT を置いていないため無料。消す理由がない |

> **この表は新しい設計で「残すことにしたもの」であり、いま AWS 上に実在するものの一覧ではありません。**
> 前回の停止はこの設計より前に行われたため、実際に残っているのは **ECR・S3・Secrets Manager の 3 つだけ**です（「既知の課題」参照）。VPC 一式は旧手順の `-target=module.vpc` で削除済み、最終スナップショットも当時は作られていません。したがって:
>
> - **初回の再開は空の DB になります**（`db_snapshot_identifier` に渡せるスナップショットが存在しない）
> - 現在の実際の請求は、保持しているシークレットが 7 件に満たないため $5〜6 より低くなります

`module "secrets"` と `module "s3"` に `count` を付けていないのは意図的です。シークレットを destroy すると `recovery_window_in_days` 既定の 30 日間削除待ちに入り、**同名のシークレットを 30 日間作り直せない = 次の再開ができなくなる**ためです。月 $2.80 を払って残す方が安く済みます。

素の `terraform destroy` を止めるための `prevent_destroy` を 2 箇所だけ置いています（`modules/secrets` の `jwt_secret` と uploads バケット）。効く範囲と効かない範囲、2 箇所に絞った理由は「[運用上の落とし穴](#運用上の落とし穴)」にまとめています。ECR・ACM 証明書・DynamoDB ロックテーブルは保持対象ですがガードを付けていません（いずれも再作成できます。ACM は再発行に DNS 検証の待ち時間、ECR は 3 イメージの再ビルドが必要）。

この表に載っていない課金もあります。`enabled_cloudwatch_logs_exports` によって AWS が作る `/aws/rds/instance/nokoroa-prod-postgres/postgresql` は Terraform の管理外・保持期間無期限で、停止しても残り続けます。

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
>
> `import` は下の手順 1〜2（変数ファイルの用意と `terraform init`）を済ませたあとに実行してください。`init` 前では `Could not load plugin` で、`runtime_enabled` を渡さないと `Error: No value for required variable` で止まります。`import` にも `-var runtime_enabled=false` が必要です（`import` 自体は `prevent_destroy` には阻害されません）。

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

# サイクル変数を置く（詳細は「サイクル変数を固定する」）。
# 初回は復元元が無いため空の DB から始める。
cat > cycle.auto.tfvars <<'EOF'
db_start_from_empty          = true
db_final_snapshot_identifier = "nokoroa-prod-initial"
EOF

terraform apply -var runtime_enabled=true
```

`db_final_snapshot_identifier` は**停止時に作るスナップショットの名前**で、起動時に渡しておく必要があります（理由は「[停止と再開](#停止と再開)」）。`db_start_from_empty` を明示しないと `modules/rds` の `precondition` が止めます。

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
terraform apply -var runtime_enabled=true
```

> 手順 2 で作った `cycle.auto.tfvars` は自動で読まれるので、スナップショット関連の `-var` を付け直す必要はありません。
>
> `runtime_enabled` には既定値がありません。付け忘れると Terraform が入力を促して止まります（黙って何かを壊すより良い、という設計です）。

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
| 常時稼働した場合 | 下記参照 | 月 $95〜130 |

価格は AWS Price List API の `ap-northeast-1` 実値（2026-10 時点）に基づく概算です。Fargate は ARM64 単価（$0.04045/vCPU 時・$0.00442/GB 時）、RDS は `db.t4g.micro` Single-AZ（$0.025/時）+ gp3 20GB（$0.138/GB 月）で計算しています。

常時稼働は上 2 行の足し算（約 $87）より高くなります。差は Container Insights のカスタムメトリクス（月 $10〜18）と ALB の LCU・データ転送で、いずれも稼働時間に比例しないため日割りに乗りません。スナップショットはサイクルごとに増えるので、下の「古いスナップショットを掃除する」も参照してください。

### サイクル変数を固定する

`runtime_enabled` 以外の 2 変数は、**サイクルのあいだ固定しておきます**。`terraform` は `*.auto.tfvars` を自動で読むため、ファイルに置けば以降すべての `plan` / `apply` に自動で効きます。

```bash
cd terraform/envs/prod
cat > cycle.auto.tfvars <<'EOF'
# 復元元（前回の停止で作られたスナップショット）
db_snapshot_identifier       = "nokoroa-prod-20261007-1030"
# 次の停止で作る最終スナップショット。復元元とは必ず別名にする
db_final_snapshot_identifier = "nokoroa-prod-20261008-0900"
EOF
```

`*.tfvars` は `.gitignore` 済みなのでコミットされません。

これを使う理由は 2 つあります。まず **`-var` の落とし忘れを構造的に無くせる**こと。この 2 変数は `modules/rds` の `precondition` が要求するため、サイクル中のどの `plan` / `apply` でも必要で、毎回 3 つのフラグを正しく並べるのは落としやすい形でした。もうひとつは **値が勝手に変わらない**こと。`$(date)` をコマンドに直接書くと実行ごとに別の名前が state へ入り、停止時に作られるスナップショット名が実行者の記憶と合わなくなります。

**`runtime_enabled` はこのファイルに入れないこと。** `true` で固定すれば素の `apply` が課金を始め、`false` で固定すれば稼働中の本番を落とします。これは「いま何をしたいか」という意図なので、毎回コマンドラインで明示します（`TF_VAR_runtime_enabled` も同じ理由で使わないこと。詳細は `terraform.tfvars.example`）。

### 停止する

```bash
terraform apply -var runtime_enabled=false
```

消えるのは次のものです。RDS は `db_final_snapshot_identifier` で指定した名前の最終スナップショットを作ってから削除されます。

- ALB（リスナー・ターゲットグループを含む）
- ECS のクラスタ・サービス・タスク定義・IAM ロール 2 種・ロググループ 3 種
- RDS インスタンス、**および DB サブネットグループとパラメータグループ**（`modules/rds` の 3 リソースはまとめて消えます）
- apex と www の A レコード

所要時間は 10〜20 分程度です。「ALB と ECS は即時」ではありません。ECS サービスの削除はタスクのドレインを待ち、ターゲットグループの登録解除遅延（既定 300 秒）と ALB 本体の削除も即時には終わりません。RDS のスナップショット作成に 5〜10 分かかります。

パラメータグループが毎サイクル作り直される点に注意してください。`shared_preload_libraries` が `apply_method = "pending-reboot"` なので、復元直後のインスタンスで `vector` 拡張が有効になるのは初回起動後です。

**停止すると CloudWatch のログ履歴が失われます。** `modules/ecs` がロググループ 3 種（backend / frontend / ai）を抱えているため、モジュールごと消えると過去のログも消えます。保持期間は 30 日設定でデモ環境のログ履歴に価値が薄いと判断して分割しませんでした。残したい場合はロググループを `runtime_enabled` の外側へ切り出してください。

### 再開する

> **初回だけは `import` が先に必要です。** AWS 上に実在する ECR・S3・Secrets Manager が state に載っていないため、そのまま apply すると名前の衝突で落ちます（「[既知の課題](#既知の課題)」）。

```bash
# 1. 復元元のスナップショットを確認する
#    --db-instance-identifier で絞らないと他プロジェクトのものが混ざる。
#    作成中のスナップショットは SnapshotCreateTime が null で sort_by が落ちるため除外する。
aws rds describe-db-snapshots \
  --snapshot-type manual \
  --db-instance-identifier nokoroa-prod-postgres \
  --query 'reverse(sort_by(DBSnapshots[?SnapshotCreateTime!=null],&SnapshotCreateTime))[:5].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table

# 2. cycle.auto.tfvars を書く（上記「サイクル変数を固定する」）

# 3. 立ち上げる
terraform apply -var runtime_enabled=true
```

**一覧が 0 件だった場合**は復元元が存在しません（現状がこれに該当します。前回の停止はこの設計より前で、最終スナップショットが作られていません）。その場合は空の DB から始めることを明示します。

```hcl
# cycle.auto.tfvars
db_start_from_empty          = true
db_final_snapshot_identifier = "nokoroa-prod-20261008-0900"
# db_snapshot_identifier は書かない
```

`db_start_from_empty` を明示させているのは、`db_snapshot_identifier` の渡し忘れで**空の DB が本番として立つ**のを防ぐためです。黙って通すと、その後の書き込みは空 DB 側に入り、次の停止が「空 DB の中身」を新しいスナップショットとして保存するため、以降「旧スナップショットに戻すと新規分が消える / 新しい方を使うと旧データが消える」の二択になります。

| 工程 | 時間 | 備考 |
|---|---|---|
| RDS スナップショットからの復元 | 10〜20 分 | ALB 作成と並列に走る |
| ALB 作成 | 3〜5 分 | RDS 復元と並列に走る |
| ECS タスク起動 + ヘルスチェック通過 | 2〜3 分 | ALB のターゲットグループが必要なので ALB の後 |
| **apply 完了まで** | **12〜23 分** | 上記の並列を考慮した壁時計（直列合計ではない） |
| DNS のネガティブキャッシュ解消 | 最大 15 分 | 下記参照 |

`module "alb"` と `module "rds"` の間に依存関係は無いため Terraform は両方を同時に作ります。したがって壁時計は `max(RDS, ALB) + ECS` になります。

ACM 証明書と DNS 検証レコードは停止しても残しているため、**証明書の再発行と DNS 検証の待ち時間は発生しません**。

ただし **A レコードそのものは停止中に消えている**（ALB と生死を共にするため）ので、停止中にドメインを引いたリゾルバは NXDOMAIN をキャッシュします。Route 53 のホストゾーン既定 SOA は `1 7200 900 1209600 86400` で、リゾルバは RFC 2308 / RFC 9077 に従って `min(SOA レコードの TTL, minimum フィールド)` を採るため、効くのは SOA レコード自身の TTL である **900 秒**です（`minimum` フィールドは 86400 ですが、こちらは上限として働きません）。再開直後に同じリゾルバ経由でアクセスすると最大 15 分引けません。**面談の 30 分前ではなく前日に立てることを強く勧めます。**

### 再開後にマイグレーションを当てる

**スナップショットから復元した場合も `migrate deploy` は必要です。** 前回の停止から今回の再開までに backend のマイグレーションが増えていると、復元した DB は旧スキーマのままで ECS がランタイムエラーになります。

空の DB から始めた場合は、**先にスキーマを適用してから** seed を流します。テーブルが無い状態で seed を実行すると全 INSERT が `relation does not exist` で失敗します。

どちらも手元からは実行できません。RDS は database サブネットにあり、セキュリティグループの ingress は ECS のセキュリティグループ参照のみで `publicly_accessible` も付けていないため、ローカルから接続できません。「[5. データベースをマイグレーションする](#5-データベースをマイグレーションする)」と同じ `run-task` で流します。

```bash
# 共通の引数（手順 5 のものを使う）
NET="awsvpcConfiguration={subnets=[PUBLIC_SUBNET_ID],securityGroups=[ECS_SG_ID],assignPublicIp=ENABLED}"

# スキーマ適用（復元した場合も空から始めた場合も実行する）
aws ecs run-task --cluster nokoroa-prod-cluster --task-definition nokoroa-prod-backend \
  --launch-type FARGATE --network-configuration "$NET" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}'

# デモデータ投入（空から始めた場合のみ。上が終わってから）
aws ecs run-task --cluster nokoroa-prod-cluster --task-definition nokoroa-prod-backend \
  --launch-type FARGATE --network-configuration "$NET" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","seed"]}]}'
```

`vector` 拡張について 1 点。パラメータグループは毎サイクル作り直され、`shared_preload_libraries` は `apply_method = "pending-reboot"` です。復元直後のインスタンスでベクトル検索が失敗する場合は再起動してください。

```bash
aws rds reboot-db-instance --db-instance-identifier nokoroa-prod-postgres
```

### 復元を指定し忘れたとき

空の DB で起動してしまった場合は是正できます（`snapshot_identifier` を `ignore_changes` に入れていないため）。ただし **`db_final_snapshot_identifier` には新しい名前を付けてください。**

```hcl
# cycle.auto.tfvars
db_snapshot_identifier       = "nokoroa-prod-20261007-1030"  # 本来使うべきだった復元元
db_final_snapshot_identifier = "nokoroa-prod-20261008-1200"  # ★ 前の値から変える
# db_start_from_empty は消す（または false）
```

```bash
terraform apply -var runtime_enabled=true
```

plan に `must be replaced` が出て確認を求められます。この replace の destroy 側も最終スナップショットを取るため、空 DB に書き込んでしまった分も失われません。

**ただしその時点で `db_final_snapshot_identifier` の名前が 1 つ消費されます。** 名前を変えずに是正すると、次の停止が同名衝突（`DBSnapshotAlreadyExists`）で失敗し、アプリだけ消えて RDS に課金が残ります。ここだけは「サイクル中は同じ値を使い回す」より優先してください。`precondition` は復元元との同名しか見ないので、この衝突は弾けません。

もう 1 つ注意点があります。この是正で作られるスナップショットは**空 DB の中身**です。つまり是正直後は「最新の手動スナップショット = 空」という状態になるので、次の再開で `describe-db-snapshots` の先頭を鵜呑みにすると空の DB を復元します。**作成時刻ではなく名前で選んでください。**

### 運用上の落とし穴

**`db_final_snapshot_identifier` は停止時ではなく起動時に渡す。** Terraform は破棄するリソースの属性を **state から** 読むため、`terraform apply -var runtime_enabled=false -var db_final_snapshot_identifier=...` のように停止と同時に渡しても無視されます。インスタンスが存在するうちの apply で state に入れておく必要があります。

`modules/rds` の `lifecycle.precondition` は、名前を渡さないままの起動を apply の時点で弾きます。**この場合の実際の挙動はデータ損失ではなく「停止 apply が『名前が必須』で失敗して止まる」こと**です（prod は `skip_final_snapshot` を渡しておらず常に `false`）。データが失われるのは `skip_final_snapshot = true` を明示したときだけです。それでも事前に弾くのは、失敗する時点では `-var` で直せず、起動し直してからやり直すしかないためです。

この precondition は no-op の plan でも評価されるため、サイクル中のあらゆる `plan` / `apply` で 2 つのスナップショット変数が必要です。だから `cycle.auto.tfvars` に固定します。

**スナップショット名はサイクルごとに一意にし、復元元と別名にする。** `precondition` が弾くのは次の 2 つだけです。

- 復元元と同名（`db_snapshot_identifier` と同じ値）
- AWS の識別子規則違反（英字始まり / 連続ハイフン不可 / ハイフン終わり不可 / 255 字以内）

**過去のスナップショットとの衝突は検知できません**（AWS に問い合わせないため）。これが残っている唯一の未対処リスクで、踏むと次のようになります。

同名のスナップショットは 2 つ作れないので、停止 apply で ALB・ECS・A レコードが先に消えた後、RDS の削除だけが `DBSnapshotAlreadyExists` で失敗します。**アプリは消えたのに RDS だけ課金が続く**状態です。しかも destroy 時には `-var` で直せないので、次の順で復旧します。

```bash
# 1. cycle.auto.tfvars の db_final_snapshot_identifier を未使用の名前に書き換える
#    （db_snapshot_identifier はそのまま。消さないこと）
# 2. 起動し直して state を書き換える（ALB/ECS が作り直されるので 12〜23 分かかる）
terraform apply -var runtime_enabled=true
# 3. 改めて停止する
terraform apply -var runtime_enabled=false
```

**削除保護は使っていません。** 以前は `deletion_protection = true` で、停止のたびに手でコードを `false` へ書き換えて apply する必要があり、その書き換え忘れで destroy が失敗していました。データは最終スナップショットで守る方針に変え、停止を 1 変数で完結させています。あわせて `delete_automated_backups = false` を明示しています（既定の `true` だと、停止のたびに保持期間分の自動バックアップと PITR 履歴まで消え、残るデータの複製が常に 1 本だけになる）。

代わりに **`prevent_destroy` を 2 箇所だけ置いています** — `modules/secrets` の `jwt_secret` と `modules/s3` の uploads バケットです。destroy の plan は 1 件でも `prevent_destroy` に当たれば全体が reject されるため、モジュールあたり 1 件で足ります。

| 経路 | 結果 |
|---|---|
| 素の `terraform destroy` | **plan 時に reject。1 つも壊れない** |
| `terraform destroy -target=module.rds`（過去の事故経路） | **reject**。`module "secrets"` が `depends_on = [module.rds]` を持つのでシークレット 7 件が destroy 集合に入る |
| `runtime_enabled = false` | 通る（ガード対象を含まないため。これが正常系） |
| 保護対象を含まない `-target`（`module.alb[0]`、ECR 単体 等） | **素通りする** |
| リソースブロックを設定から削除 | **素通りする** |

7 件全部に付けない理由は、`lifecycle` が literal しか取れず**変数で解除できない**ためです。共有モジュールに撒くと、`envs/stg` のような使い捨て環境が `terraform destroy` できなくなり、外すにはモジュール本文を編集する（= prod のガードも同時に外れる）しかなくなります。同じ理由で `aws_s3_bucket.terraform_state` にも付けていません（`count` を持つので `create_terraform_state_bucket = false` に戻す経路が解除不能な plan エラーになり、既知の課題が掲げるブートストラップ分離を自分で塞いでしまう）。

RDS インスタンス自体には付けられません（`runtime_enabled = false` が destroy なので、付けると停止そのものができなくなる）。RDS は最終スナップショットで守る形です。

**`prevent_destroy` は state に載っているリソースにしか効きません。** 現在 AWS 上に実在する ECR・S3・Secrets Manager は state に未登録なので、`terraform import` を済ませるまでこのガードは無力です。

> ### ⚠️ RDS を `import` したら、停止する前に必ず 1 回起動 apply を通すこと
>
> AWS プロバイダの `import` は **`skip_final_snapshot = true` を state に書き込みます**。destroy は config ではなく state を読むため、RDS インスタンスを `import` した直後に `terraform apply -var runtime_enabled=false` を実行すると、**最終スナップショットを取らずに削除されてデータが無言で全損します**。
>
> `runtime_enabled = false` ではモジュールが `count = 0` になり destroy だけが計画されるので、`skip_final_snapshot: true -> false` の是正 update は走りません。`precondition` も config の値（`false`）を見ているだけで state の `true` を検知できません。
>
> ```bash
> terraform import 'module.rds[0].aws_db_instance.main' nokoroa-prod-postgres
> terraform apply -var runtime_enabled=true   # ★ ここで state の skip_final_snapshot が false に直る
> terraform apply -var runtime_enabled=false  # 停止はこの後
> ```
>
> 現在は RDS インスタンスが存在しないため `import` 対象に入りませんが、稼働中に state を失った場合はこの経路を踏みます。`delete_automated_backups` も同様に `import` で `true` に固定されるため、起動 apply を飛ばすと自動バックアップごと消えます。

**`count` の導入で state 上のアドレスが変わりました。** `module.alb` / `module.ecs` / `module.rds` 配下の全リソースと `aws_route53_record.alb` / `.www` に `[0]` が付きます。index 無しの古い state を持っている場合は、apply する前に `terraform state mv` でアドレスを移してください（移さないと全部が destroy + create として計画されます）。本番 state は現在空なのでこのケースには該当しません。

### 古いスナップショットを掃除する

名前をサイクルごとに変えるため、スナップショットは停止するたびに 1 つ増えます。復元元として使う 1 つ前は残し、それより古いものは消してください。

```bash
aws rds describe-db-snapshots \
  --snapshot-type manual \
  --db-instance-identifier nokoroa-prod-postgres \
  --query 'reverse(sort_by(DBSnapshots[?SnapshotCreateTime!=null],&SnapshotCreateTime))[].[DBSnapshotIdentifier,SnapshotCreateTime,AllocatedStorage]' \
  --output table

aws rds delete-db-snapshot --db-snapshot-identifier <古い名前>
```

**稼働していない時期の apply にも `-var runtime_enabled=false` が必要です。** 停止中に ECR のライフサイクルや S3 の CORS だけ変えたい場合も同じで、プロンプトに `true` と答えると無言で課金が始まります。

## 既知の課題

- **state が S3 に置かれていない**: `versions.tf` の S3 backend がコメントアウトされたままで、state はローカル管理です。保管先のバケットと DynamoDB ロックテーブルは `modules/s3` に定義済みですが、state を置くバケット自身を同じ設定で作る循環があるため、ブートストラップを分ける必要があります。
- **残しているリソースが state に載っていない**: AWS 上に実在する ECR・S3・Secrets Manager が、現在の state には記録されていません。このため今のまま `terraform apply` を実行すると、ECR・S3・Secrets Manager が既存と衝突します。再構築の前に `terraform import` で state に取り込む必要があります。Secrets Manager は削除待ち中のものが混ざりうるため、`import` の前に `list-secrets --include-planned-deletion` で状態を確認してください（削除待ちのものは `import` できず、`restore-secret` か待機満了が必要です）。
- **変数の `validation` がほぼ未設定**: 101 個の変数すべてに `description` と `type` はありますが、値域の検証が入っているのは `final_snapshot_identifier`（AWS の識別子規則）の 1 個だけです。
- **`import` 対象の一覧が無い**: 上記の 3 種に加えて、実在するなら state ロック用の DynamoDB テーブルも対象です。また `modules/s3` は 11 リソースあり、バケット本体を `import` してもバージョニング・暗号化・CORS・バケットポリシーは別途 `import` か再作成になります。アドレスと物理 ID の対応表を用意していません。
