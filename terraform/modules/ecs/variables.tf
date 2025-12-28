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

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "ECS security group ID"
  type        = string
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

variable "api_domain" {
  description = "API domain"
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
