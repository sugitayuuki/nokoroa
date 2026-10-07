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
  # 注意: snapshot_identifier による復元を入れたため、再開は「新規作成」ではなくなった。
  # スナップショット側のエンジンバージョンがこの family と var.engine_version に
  # 整合している必要がある（自分で取ったスナップショットから戻す限りは一致する）。
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

  # snapshot_identifier から復元する場合、RDS API は db_name を無視する（DB 名は
  # スナップショットに含まれるものが使われる）。自分で取ったスナップショットから戻す限りは
  # 同名なので plan に差分は出ないが、他所から持ち込んだスナップショットでは食い違う。
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
  final_snapshot_identifier = var.skip_final_snapshot ? null : var.final_snapshot_identifier

  snapshot_identifier = var.snapshot_identifier

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }

  lifecycle {
    # スナップショット名が無いまま skip_final_snapshot = false だと、destroy を叩いた
    # 瞬間に「名前が必須」で落ちて停止がブロックされる。しかもその時点では -var で
    # 後付けできない (variables.tf の final_snapshot_identifier のコメント参照) ため、
    # インスタンスが存在するうちの apply で弾く。
    #
    # 2 つ目の条件が無いと、final_snapshot_identifier に「復元元と同じ名前」を渡せてしまう。
    # README の再開コマンドは 2 つの -var を隣接行に並べているためコピペで同値になりやすく、
    # その場合 ALB・ECS・A レコードが先に消えた後で DeleteDBInstance だけが
    # DBSnapshotAlreadyExists で失敗する。アプリは消えたのに RDS だけ課金が続き、
    # かつ destroy 時には -var で直せないので、起動し直してからやり直すしかなくなる。
    precondition {
      condition = var.skip_final_snapshot || (
        var.final_snapshot_identifier != null &&
        var.final_snapshot_identifier != var.snapshot_identifier
      )
      error_message = "final_snapshot_identifier には snapshot_identifier と異なる一意な名前を指定してください（データを捨てて良い場合に限り skip_final_snapshot = true）。"
    }
  }
}

# ignore_changes = [snapshot_identifier] は意図的に採用していない。
# replace の暴発は防げるが、代償として「復元指定を忘れた再開」の是正まで無効化する:
# -var db_snapshot_identifier を付け忘れて空 DB で起動したあと、正しい名前を足して
# 再 apply しても plan が "No changes" を返し、空の DB が本番として公開され続ける。
# 採用しない場合は plan に "must be replaced" が出て確認を求められ、しかも replace の
# destroy 側も final_snapshot_identifier を尊重するためスナップショットは取られる。
# 「黙って間違った状態が続く」より「見える形で確認を求められ、データも残る」を選ぶ。