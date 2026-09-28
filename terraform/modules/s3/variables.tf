variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

# 既定値を置かない。既定 ["*"] だと指定を忘れたまま apply した環境が
# 全オリジンからのアップロードバケット参照を許してしまうため、呼び出し側に
# 明示させる。
variable "allowed_origins" {
  description = "Allowed origins for the uploads bucket CORS rule. Required: pass the exact scheme+host list for the environment."
  type        = list(string)
}

variable "create_terraform_state_bucket" {
  description = "Create S3 bucket for Terraform state"
  type        = bool
  default     = false
}