# Random Passwords
# 注意: backend の src/auth/jwt-secret.ts が 32 文字以上を必須としているため、
# この length を 32 未満にすると本番が起動しなくなる。
# また length を変更すると鍵が再生成され、既存セッションは全て無効になる。
resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

# Internal API token used between Backend ECS task and AI sidecar
resource "random_password" "internal_api_key" {
  length  = 48
  special = false
}

# Database Password Secret
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${var.project_name}-${var.environment}-db-password"
  description = "Database password for RDS PostgreSQL"

  tags = {
    Name = "${var.project_name}-${var.environment}-db-password"
  }

  # このモジュールの 7 件のシークレットはすべて prevent_destroy で守る。
  # recovery_window_in_days を明示していないため destroy は既定 30 日の削除待ちに入り、
  # その間は同名で作り直せない = 停止・再開サイクルの「再開」ができなくなる。
  # envs/prod が RDS の deletion_protection をやめた結果、素の terraform destroy や
  # -target を止めるものが構成全体から無くなったため、ここでフェイルクローズさせる。
  # runtime_enabled による停止・再開はこのモジュールを destroy 対象にしないので干渉しない。
  #
  # recovery_window_in_days = 0 にはしない。即時完全削除になり「誤 destroy からの復旧」が
  # 一切できなくなるため、事故耐性が下がる。30 日待ちは事故時の保険として機能しており、
  # 問題は「同名で作り直せない」ことだけなので、destroy させない方で解く。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}-${var.environment}-jwt-secret"
  description = "JWT secret for authentication"

  tags = {
    Name = "${var.project_name}-${var.environment}-jwt-secret"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# Database URL Secret (complete connection string)
resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.project_name}-${var.environment}-database-url"
  description = "Complete database connection URL"

  tags = {
    Name = "${var.project_name}-${var.environment}-database-url"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}"
}

# Google OAuth Client ID
resource "aws_secretsmanager_secret" "google_client_id" {
  name        = "${var.project_name}-${var.environment}-google-client-id"
  description = "Google OAuth Client ID"

  tags = {
    Name = "${var.project_name}-${var.environment}-google-client-id"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "google_client_id" {
  secret_id     = aws_secretsmanager_secret.google_client_id.id
  secret_string = var.google_client_id
}

# Google OAuth Client Secret
resource "aws_secretsmanager_secret" "google_client_secret" {
  name        = "${var.project_name}-${var.environment}-google-client-secret"
  description = "Google OAuth Client Secret"

  tags = {
    Name = "${var.project_name}-${var.environment}-google-client-secret"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "google_client_secret" {
  secret_id     = aws_secretsmanager_secret.google_client_secret.id
  secret_string = var.google_client_secret
}

# Gemini API Key
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name        = "${var.project_name}-${var.environment}-gemini-api-key"
  description = "Google Gemini API key used by AI sidecar"

  tags = {
    Name = "${var.project_name}-${var.environment}-gemini-api-key"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  secret_id     = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = var.gemini_api_key
}

# Internal API Key (Backend <-> AI sidecar shared secret)
resource "aws_secretsmanager_secret" "internal_api_key" {
  name        = "${var.project_name}-${var.environment}-internal-api-key"
  description = "Shared secret between Backend and AI sidecar"

  tags = {
    Name = "${var.project_name}-${var.environment}-internal-api-key"
  }

  # 理由は db_password の prevent_destroy のコメント参照。
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "internal_api_key" {
  secret_id     = aws_secretsmanager_secret.internal_api_key.id
  secret_string = random_password.internal_api_key.result
}

# IAM Policy for ECS to read secrets
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_policy" "secrets_read" {
  name        = "${var.project_name}-${var.environment}-secrets-read"
  description = "Allow ECS tasks to read secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.database_url.arn,
          aws_secretsmanager_secret.google_client_id.arn,
          aws_secretsmanager_secret.google_client_secret.arn,
          aws_secretsmanager_secret.gemini_api_key.arn,
          aws_secretsmanager_secret.internal_api_key.arn
        ]
      }
    ]
  })
}
