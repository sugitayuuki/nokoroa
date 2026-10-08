variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

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

# AI プロバイダの鍵は「使うものだけ」渡す。空文字を渡した鍵は Secrets Manager に
# 作られない (AWS は空の secret_string を受け付けないため)。
#
# ★ 既に作成済みの鍵を空文字へ変えると、その Secret は削除がスケジュールされる。
#   Secrets Manager は復旧期間(既定7日)が明けるまで同名での再作成を拒むため、
#   使わないプロバイダの鍵でも、しばらくは値を残しておく方が安全。
variable "gemini_api_key" {
  description = "Gemini API key for AI service (empty to skip creating the secret)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for AI service (empty to skip creating the secret)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key for embeddings (empty to skip creating the secret)"
  type        = string
  sensitive   = true
  default     = ""
}
