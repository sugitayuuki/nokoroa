# Secret ARNs (for ECS task definition)
output "db_password_arn" {
  description = "ARN of the database password secret"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  description = "ARN of the JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

# version 側の arn を返す（値はシークレット本体の ARN と同一）。本体を参照すると
# 「タスク定義が参照する ARN」と「値を書き込む secret_version」の間に順序エッジが無く、
# 再開 apply でタスク起動が値の書き込みより先に走って停止中の placeholder を掴みうる。
# version 経由にすることで、本物のデータフロー依存として順序が決まる。
output "database_url_arn" {
  description = "ARN of the database URL secret (via the version, so consumers wait for the value to be written)"
  value       = aws_secretsmanager_secret_version.database_url.arn
}

output "google_client_id_arn" {
  description = "ARN of the Google Client ID secret"
  value       = aws_secretsmanager_secret.google_client_id.arn
}

output "google_client_secret_arn" {
  description = "ARN of the Google Client Secret secret"
  value       = aws_secretsmanager_secret.google_client_secret.arn
}

output "gemini_api_key_arn" {
  description = "ARN of the Gemini API key secret"
  value       = aws_secretsmanager_secret.gemini_api_key.arn
}

output "internal_api_key_arn" {
  description = "ARN of the internal API key secret"
  value       = aws_secretsmanager_secret.internal_api_key.arn
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
