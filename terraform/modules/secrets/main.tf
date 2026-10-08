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

  # このモジュールで prevent_destroy を付けるのはこの 1 件だけ。plan は 1 件でも当たれば
  # 全体が reject されるので、モジュール内に 1 件あれば destroy は止まる。この 1 件を
  # 選んだのは、値が random_password 由来で state にしか存在しないため。
  # 7 件すべてに付けない理由と、作り直しを前提とする環境での扱いは
  # terraform/README.md「運用上の落とし穴」を参照（lifecycle は変数で解除できないため、
  # ここを編集すると他の環境のガードも同時に外れる）。
  #
  # recovery_window_in_days = 0 は採らない（即時完全削除になり誤 destroy から復旧できない）。
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
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  # ユーザー名とパスワードは必ず urlencode を通す。
  # db_password は envs/prod の random_password が override_special に
  # "#" と "?" を含むプールで生成するため、生のまま埋めると URL の
  # フラグメント / クエリ区切りとして解釈されてパスワードが切り詰められ、
  # backend が DB へ接続できず起動しない。16 文字生成では 3 割強の確率で踏み、
  # ログ上は「認証失敗」に見えるため原因の特定が難しい非決定的障害になる。
  # (生成文字に空白は含まれないため、urlencode の空白→"+" 変換は影響しない)
  secret_string = "postgresql://${urlencode(var.db_username)}:${urlencode(var.db_password)}@${var.db_host}:${var.db_port}/${var.db_name}"
}

# Google OAuth Client ID
resource "aws_secretsmanager_secret" "google_client_id" {
  name        = "${var.project_name}-${var.environment}-google-client-id"
  description = "Google OAuth Client ID"

  tags = {
    Name = "${var.project_name}-${var.environment}-google-client-id"
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
}

resource "aws_secretsmanager_secret_version" "google_client_secret" {
  secret_id     = aws_secretsmanager_secret.google_client_secret.id
  secret_string = var.google_client_secret
}

# AI プロバイダの鍵。使うものだけ作る (variables.tf の注意書きを参照)。
resource "aws_secretsmanager_secret" "gemini_api_key" {
  count       = var.gemini_api_key != "" ? 1 : 0
  name        = "${var.project_name}-${var.environment}-gemini-api-key"
  description = "Google Gemini API key used by AI sidecar"

  tags = {
    Name = "${var.project_name}-${var.environment}-gemini-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  count         = var.gemini_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.gemini_api_key[0].id
  secret_string = var.gemini_api_key
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  count       = var.anthropic_api_key != "" ? 1 : 0
  name        = "${var.project_name}-${var.environment}-anthropic-api-key"
  description = "Anthropic API key used by AI sidecar"

  tags = {
    Name = "${var.project_name}-${var.environment}-anthropic-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  count         = var.anthropic_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.anthropic_api_key[0].id
  secret_string = var.anthropic_api_key
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  count       = var.openai_api_key != "" ? 1 : 0
  name        = "${var.project_name}-${var.environment}-openai-api-key"
  description = "OpenAI API key used by AI sidecar for embeddings"

  tags = {
    Name = "${var.project_name}-${var.environment}-openai-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  count         = var.openai_api_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.openai_api_key[0].id
  secret_string = var.openai_api_key
}

# Internal API Key (Backend <-> AI sidecar shared secret)
resource "aws_secretsmanager_secret" "internal_api_key" {
  name        = "${var.project_name}-${var.environment}-internal-api-key"
  description = "Shared secret between Backend and AI sidecar"

  tags = {
    Name = "${var.project_name}-${var.environment}-internal-api-key"
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
        Resource = concat(
          [
            aws_secretsmanager_secret.db_password.arn,
            aws_secretsmanager_secret.jwt_secret.arn,
            aws_secretsmanager_secret.database_url.arn,
            aws_secretsmanager_secret.google_client_id.arn,
            aws_secretsmanager_secret.google_client_secret.arn,
            aws_secretsmanager_secret.internal_api_key.arn,
          ],
          # 作成しなかった鍵は ARN が無いので compact で落とす。
          # null を混ぜたままにすると IAM ポリシーの作成自体が失敗する。
          compact([
            one(aws_secretsmanager_secret.gemini_api_key[*].arn),
            one(aws_secretsmanager_secret.anthropic_api_key[*].arn),
            one(aws_secretsmanager_secret.openai_api_key[*].arn),
          ])
        )
      }
    ]
  })
}
