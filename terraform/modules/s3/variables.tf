variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "allowed_origins" {
  description = "Allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "create_terraform_state_bucket" {
  description = "Create S3 bucket for Terraform state"
  type        = bool
  default     = false
}