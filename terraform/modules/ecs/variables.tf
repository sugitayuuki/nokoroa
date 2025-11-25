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

variable "db_endpoint" {
  description = "Database endpoint"
  type        = string
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

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
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