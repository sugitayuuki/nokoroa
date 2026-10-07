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
  name = "${var.project_name}-${var.environment}-pg15-params"
  # ローカル compose / CI は pgvector/pgvector:pg16。検証環境と本番の
  # メジャーバージョンを揃える。
  family = "postgres16"

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

  # 復元時、RDS API は db_name を無視する（DB 名はスナップショット側の値が使われる）。
  # 他所から持ち込んだスナップショットでは config と食い違う。
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

  # 削除保護とスナップショットの有無は連動させない（連動させると保護を有効にした時点で
  # スナップショット名が必須になり、名前を渡す手段が無いと destroy が常に失敗する）。
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.final_snapshot_identifier

  snapshot_identifier = var.snapshot_identifier

  # 既定の true だと、destroy のたびに自動バックアップと PITR 履歴が最終スナップショットの
  # 作成と同時に全削除され、残るデータの複製が常に 1 本だけになる。
  delete_automated_backups = false

  # 既定の true だと AWS がメンテナンス窓でマイナー版を上げうる。上がった後のスナップショットを
  # 復元すると、provider が restore 後に古い engine_version で ModifyDBInstance を投げて失敗する。
  auto_minor_version_upgrade = false

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }

  lifecycle {
    # ignore_changes = [snapshot_identifier] は入れない。replace の暴発は防げるが、
    # 「復元指定を忘れた再開」の是正まで黙って殺す。

    # 停止時の失敗を apply 時点へ前倒しする（destroy の瞬間には直せない。
    # variables.tf の final_snapshot_identifier のコメント参照）。復元元と同名を渡すと、
    # ALB・ECS・A レコードが消えた後で DeleteDBInstance だけが DBSnapshotAlreadyExists で
    # 落ち、RDS だけ課金が残る。
    # 過去のスナップショットとの衝突は AWS に問い合わせないため検知できない。
    precondition {
      condition = var.skip_final_snapshot || (
        var.final_snapshot_identifier != null &&
        var.final_snapshot_identifier != var.snapshot_identifier
      )
      error_message = "final_snapshot_identifier には snapshot_identifier と異なる一意な名前を指定してください（データを捨てて良い場合に限り skip_final_snapshot = true）。"
    }

    # 復元元の指定忘れで空の DB が本番として立つのを防ぐ。排他（XOR）なので、
    # 「初回構築で start_from_empty = true にしたまま消し忘れた」状態も弾ける
    # （|| だとそのとき無条件に通り、このチェックが存在しないのと同じになる）。
    # 上の precondition の第 2 条件が「!= null」に退化するのも、これが防いでいる。
    precondition {
      condition     = var.start_from_empty != (var.snapshot_identifier != null)
      error_message = "snapshot_identifier と start_from_empty はどちらか一方だけを指定してください（復元するなら start_from_empty を外す / 空から始めるなら snapshot_identifier を外す）。"
    }
  }
}
