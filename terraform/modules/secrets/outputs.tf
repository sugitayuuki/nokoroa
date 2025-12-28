# Secret ARNs (for ECS task definition)
output "db_password_arn" {
  description = "ARN of the database password secret"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  description = "ARN of the JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "database_url_arn" {
  description = "ARN of the database URL secret"
  value       = aws_secretsmanager_secret.database_url.arn
}

output "google_client_id_arn" {
  description = "ARN of the Google Client ID secret"
  value       = aws_secretsmanager_secret.google_client_id.arn
}

output "google_client_secret_arn" {
  description = "ARN of the Google Client Secret secret"
  value       = aws_secretsmanager_secret.google_client_secret.arn
}

# IAM Policy ARN (to attach to ECS execution role)
output "secrets_read_policy_arn" {
  description = "ARN of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read.arn
}

# Plain values (for cases where direct access is needed)
output "jwt_secret" {
  description = "JWT secret value"
  value       = random_password.jwt_secret.result
  sensitive   = true
}
