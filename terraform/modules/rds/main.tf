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

  # 削除保護とスナップショットの有無を切り離している。以前は
  # skip_final_snapshot = !deletion_protection と連動させていたため、保護を有効にすると
  # スナップショット名が必須になるのに変数が無く、destroy が常に失敗していた。
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.final_snapshot_identifier

  snapshot_identifier = var.snapshot_identifier

  # 既定の true だと、destroy のたびに backup_retention_period 日分の自動バックアップと
  # PITR 履歴が最終スナップショットの作成と同時に全削除される。停止・再開を繰り返す構成では
  # 「停止後に残るデータの複製が常に 1 本だけ」になり、その 1 本を取り違えて消したら終わる。
  # deletion_protection をやめた分、ここは保持側に倒す。
  delete_automated_backups = false

  # 既定の true だと AWS がメンテナンス窓でマイナー版を上げうる。復元が正常系になった以上、
  # 上がった後のスナップショットから戻すと provider が restore 後の ModifyDBInstance へ
  # 古い engine_version を渡し、ダウングレード不可で失敗する。
  auto_minor_version_upgrade = false

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }

  lifecycle {
    # ignore_changes = [snapshot_identifier] は入れない。replace の暴発は防げるが、
    # 「復元指定を忘れた再開」の是正まで黙って殺す（README「再開する」参照）。

    # 停止時の失敗を apply 時点へ前倒しする。destroy の瞬間には -var で直せない
    # (variables.tf の final_snapshot_identifier のコメント参照) ため、ここで弾く。
    # 復元元と同名を渡すと、ALB・ECS・A レコードが消えた後で DeleteDBInstance だけが
    # DBSnapshotAlreadyExists で落ち、RDS だけ課金が残る。
    precondition {
      condition = var.skip_final_snapshot || (
        var.final_snapshot_identifier != null &&
        var.final_snapshot_identifier != var.snapshot_identifier
      )
      error_message = "final_snapshot_identifier には snapshot_identifier と異なる一意な名前を指定してください（データを捨てて良い場合に限り skip_final_snapshot = true）。"
    }

    # 復元元の指定忘れを弾く。渡し忘れると RestoreDBInstanceFromDBSnapshot ではなく
    # CreateDBInstance が走り、空の DB が本番として立つ。その後の書き込みは空 DB 側に入り、
    # 次の停止が「空 DB の中身」を新しいスナップショットとして保存するため、
    # 以降「旧スナップショットに戻すと新規分が消える / 新しい方を使うと旧データが消える」
    # の二択になる。空から始めるのは start_from_empty の明示オプトインに限る。
    precondition {
      condition     = var.start_from_empty || var.snapshot_identifier != null
      error_message = "snapshot_identifier を指定するか、空の DB から始める場合に限り start_from_empty = true を指定してください。"
    }
  }
}
