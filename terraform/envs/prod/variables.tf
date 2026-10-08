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

# Database variables
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "nokoroa_db"
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

# ★ 使うプロバイダの鍵だけ設定する。空のままにした鍵は Secrets Manager に
#   作られず、ECS のコンテナ定義からも外れる。
#   既に作成済みの鍵を空へ戻すと Secret は削除予約され、復旧期間(既定7日)が
#   明けるまで同名で作り直せない点に注意。
variable "gemini_api_key" {
  description = "Gemini API key (Google AI Studio). Required when chat_provider or embedding_provider is gemini."
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key. Required when chat_provider is claude."
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key. Required when embedding_provider is openai."
  type        = string
  sensitive   = true
  default     = ""
}

variable "chat_provider" {
  description = "Chat provider for the AI sidecar (gemini or claude)"
  type        = string
  default     = "gemini"
}

variable "embedding_provider" {
  description = "Embedding provider for the AI sidecar (gemini or openai)"
  type        = string
  default     = "gemini"
}
