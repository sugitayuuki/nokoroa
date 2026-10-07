# one() を使っている output（alb / rds / ecs）は runtime_enabled = false で
# インスタンスを持たない。one() は要素 0 で null を返すため、停止中でも
# `terraform output` が「存在しないインデックス参照」で落ちない（[0] 直書きだと落ちる）。
output "alb_dns_name" {
  description = "DNS name of the load balancer (null while runtime_enabled = false)"
  value       = one(module.alb[*].alb_dns_name)
}

output "rds_endpoint" {
  description = "RDS instance endpoint (null while runtime_enabled = false)"
  value       = one(module.rds[*].db_instance_endpoint)
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for uploads"
  value       = module.s3.uploads_bucket_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster (null while runtime_enabled = false)"
  value       = one(module.ecs[*].cluster_name)
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "domain_name" {
  description = "Domain name"
  value       = "https://${var.app_domain}"
}

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_ai_repository_url" {
  description = "ECR repository URL for AI service"
  value       = aws_ecr_repository.ai.repository_url
}

# Secrets Manager ARNs
output "secrets_database_url_arn" {
  description = "ARN of the DATABASE_URL secret in Secrets Manager"
  value       = module.secrets.database_url_arn
}

output "secrets_jwt_secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  value       = module.secrets.jwt_secret_arn
}

output "secrets_google_client_id_arn" {
  description = "ARN of the Google Client ID secret in Secrets Manager"
  value       = module.secrets.google_client_id_arn
}

output "secrets_google_client_secret_arn" {
  description = "ARN of the Google Client Secret secret in Secrets Manager"
  value       = module.secrets.google_client_secret_arn
}
