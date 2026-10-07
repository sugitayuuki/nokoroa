variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "nokoroa"
}

variable "app_domain" {
  # 注意: frontend バンドルが叩く API オリジンはビルド時に焼き込まれる
  # (.github/workflows/deploy.yml と ci.yml の NEXT_PUBLIC_API_URL)。
  # このドメインを変更する場合は両ワークフローの値も併せて変更すること。
  description = "Public apex domain (Route 53 hosted zone / ACM certificate / application URLs). Changing this also requires updating NEXT_PUBLIC_API_URL in .github/workflows/{deploy,ci}.yml"
  type        = string
  default     = "nokoroa.com"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

# 時間課金されるリソース（ALB / ECS サービス / RDS インスタンス）を作るかどうか。
# 面談・デモの前に立ち上げ、終わったら落とす運用のためのスイッチ。
#
# 既定値を置かない理由: default = false にすると素の `terraform apply` が稼働中の本番を
# 破壊し、default = true にすると素の `apply` が課金を開始する。どちらも事故るため、
# 実行者に毎回明示させる（未指定なら Terraform が入力を促して止まる）。
variable "runtime_enabled" {
  description = "Create the hourly-billed resources (ALB / ECS services / RDS instance). No default: every apply must state the intent explicitly"
  type        = bool
}

# Database variables
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "nokoroa_db"
}

# 停止時に作る最終スナップショットの名前。サイクルごとに一意な値を **起動時の apply で**
# 渡す（destroy 時に渡しても state から読まれるため効かない。
# modules/rds/variables.tf の落とし穴を参照）。
variable "db_final_snapshot_identifier" {
  description = "Name of the final RDS snapshot taken when runtime_enabled flips to false. Pass a value unique per cycle at start-up time"
  type        = string
  default     = null
}

# 前回の停止で作ったスナップショットから復元する場合にその名前を渡す。
# 渡し忘れは modules/rds の precondition が弾く（空の DB が本番として立つのを防ぐため）。
variable "db_snapshot_identifier" {
  description = "Restore the database from this snapshot"
  type        = string
  default     = null
}

# 空の DB から始めることを明示する。初回構築と意図的な初期化のときだけ true にする。
variable "db_start_from_empty" {
  description = "Create an empty database instead of restoring. Required when db_snapshot_identifier is not set"
  type        = bool
  default     = false
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "postgres"
}

# Application variables
variable "backend_image" {
  description = "Backend Docker image"
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Frontend Docker image"
  type        = string
  default     = ""
}

variable "ai_image" {
  description = "AI sidecar Docker image"
  type        = string
  default     = ""
}

variable "backend_port" {
  description = "Backend application port"
  type        = number
  default     = 3001
}

variable "frontend_port" {
  description = "Frontend application port"
  type        = number
  default     = 3000
}

# Google OAuth variables
variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Gemini API key (Google AI Studio)"
  type        = string
  sensitive   = true
}
