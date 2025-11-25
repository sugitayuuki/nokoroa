output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for uploads"
  value       = module.s3.uploads_bucket_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "database_connection_string" {
  description = "Database connection string"
  value       = "postgresql://${var.db_username}:${random_password.db_password.result}@${module.rds.db_instance_address}:5432/${var.db_name}"
  sensitive   = true
}

output "db_password" {
  description = "Database password (also stored in Secrets Manager)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "jwt_secret" {
  description = "JWT secret (also stored in Secrets Manager)"
  value       = random_password.jwt_secret.result
  sensitive   = true
}

output "secrets_manager_db_password_arn" {
  description = "ARN of the Secrets Manager secret for database password"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "secrets_manager_jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret for JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "domain_name" {
  description = "Domain name"
  value       = "https://nokoroa.com"
}

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}