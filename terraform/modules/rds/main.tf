# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-pg15-params"
  family = "postgres15"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,vector"
    apply_method = "pending-reboot"
  }

  # log_statement = "all" + log_duration = 1 は全 SQL をパラメータ込みで CloudWatch Logs へ
  # 永続化するため、(1) ログ量に比例した課金、(2) 書き込み負荷、(3) 個人情報が
  # ログに残る、の 3 点で本番運用に耐えない。スキーマ変更の監査だけを残し、
  # 性能調査は「遅いクエリのみ」に絞る方針へ変更した。
  # 注意: log_min_duration_statement は遅いクエリの SQL 全文(リテラル込み)を出力するため、
  # 個人情報の残留は「全クエリ → 1秒以上のクエリのみ」への縮小であって根絶ではない。
  # また all → ddl で DML の監査証跡は失われる。監査要件が生じた場合は
  # pgaudit(書き込み文のみ記録等)での補填を検討すること。
  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_duration"
    value = "0"
  }

  # 1 秒以上かかったクエリだけを記録する（全文ログの代替）
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pg15-params"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}-postgres"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  vpc_security_group_ids = [var.rds_security_group_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.deletion_protection
  skip_final_snapshot = !var.deletion_protection

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}