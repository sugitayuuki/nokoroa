variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "ECS security group ID"
  type        = string
}

# 空文字のときパブリックのプレースホルダイメージへフォールバックする挙動を許すか。
# 既定を false にしているのは、黙って通すと「apply は成功して ALB の DNS も返るのに
# backend が永久に起動しない」本番が立つため（ai が python:3.12-slim になり HTTP を
# 喋らず dependsOn: HEALTHY を満たせない）。初回構築のときだけ true にする。
variable "allow_placeholder_images" {
  description = "Allow falling back to public placeholder images when an image variable is empty"
  type        = bool
  default     = false
}

variable "backend_image" {
  description = "Backend Docker image"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image"
  type        = string
}

variable "backend_port" {
  description = "Backend port"
  type        = number
}

variable "frontend_port" {
  description = "Frontend port"
  type        = number
}

# アップロード用 S3 バケットは modules/s3 が名前を決めている。ここで
# "${project}-${env}-uploads" を組み直すと、あちらの命名を変えた瞬間に IAM ポリシーと
# AWS_BUCKET_NAME が無言で実在しないバケットを指すため、必ず output を受け取る。
variable "uploads_bucket_name" {
  description = "Name of the uploads S3 bucket (pass modules/s3 output; do not rebuild the string)"
  type        = string
}

variable "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket (pass modules/s3 output; do not rebuild the string)"
  type        = string
}

variable "app_domain" {
  description = "Public domain that serves both the frontend and the /api/* backend routes (must match the ACM certificate). Used for GOOGLE_CALLBACK_URL and FRONTEND_URL."
  type        = string
}

variable "backend_target_group_arn" {
  description = "Backend target group ARN"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "Frontend target group ARN"
  type        = string
}

variable "backend_lb_listener_arn" {
  description = "Backend load balancer listener ARN"
  type        = string
}

variable "frontend_lb_listener_arn" {
  description = "Frontend load balancer listener ARN"
  type        = string
}

variable "backend_desired_count" {
  description = "Backend desired count"
  type        = number
  default     = 1
}

variable "frontend_desired_count" {
  description = "Frontend desired count"
  type        = number
  default     = 1
}

variable "backend_cpu" {
  description = "Backend CPU units"
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Backend memory"
  type        = number
  default     = 512
}

variable "frontend_cpu" {
  description = "Frontend CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend memory"
  type        = number
  default     = 512
}

# Secrets Manager ARNs
variable "database_url_secret_arn" {
  description = "ARN of the DATABASE_URL secret in Secrets Manager"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of the JWT_SECRET in Secrets Manager"
  type        = string
}

variable "google_client_id_secret_arn" {
  description = "ARN of the Google Client ID secret in Secrets Manager"
  type        = string
}

variable "google_client_secret_arn" {
  description = "ARN of the Google Client Secret in Secrets Manager"
  type        = string
}

variable "secrets_read_policy_arn" {
  description = "ARN of the IAM policy for reading secrets"
  type        = string
}

# AI sidecar (Python FastAPI, embedded into the backend task)
variable "ai_image" {
  description = "AI sidecar Docker image"
  type        = string
  default     = ""
}

variable "ai_port" {
  description = "AI sidecar port (localhost only)"
  type        = number
  default     = 8000
}

variable "ai_cpu" {
  description = "AI sidecar CPU units"
  type        = number
  default     = 256
}

variable "ai_memory" {
  description = "AI sidecar memory"
  type        = number
  default     = 512
}

variable "gemini_api_key_secret_arn" {
  description = "ARN of the Gemini API key secret"
  type        = string
}

variable "internal_api_key_secret_arn" {
  description = "ARN of the internal API key secret (Backend <-> AI sidecar)"
  type        = string
}
