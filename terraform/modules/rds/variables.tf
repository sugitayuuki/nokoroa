variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "database_subnet_ids" {
  description = "Database subnet IDs"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "RDS security group ID"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# ECS タスクを ARM64 (Graviton) で統一しているため、RDS も既定を t4g 系に揃える。
# prod は envs/prod/main.tf で db.t4g.micro を明示しており、この既定値を変えても
# 現行環境の plan 差分は出ない（新しい環境を足したときの初期値だけが変わる）。
variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.11"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

# 削除時にスナップショットを取らずデータを捨てる。既定を false にしているのは、
# 「指定を忘れた」状態でデータが消えないようにするため。true は捨てて良いと
# 分かっている環境（stg / 使い捨て検証）でのみ明示する。
variable "skip_final_snapshot" {
  description = "Destroy the instance without taking a final snapshot (data loss)"
  type        = bool
  default     = false
}

# 削除時に作る最終スナップショットの名前。
#
# 落とし穴: この値は destroy 時に **state から** 読まれる。destroy と同じ
# コマンドで `-var` に渡しても、破棄されるリソースへ新しい設定値は適用されないため
# 無視される。したがって「インスタンスが存在するうちに apply で state へ入れておく」
# 必要があり、停止・再開を繰り返す運用では **起動時に** サイクルごと一意な名前を
# 渡す（停止時ではない）。
#
# timestamp() で自動生成しない理由: 毎回値が変わるため plan に差分が出続け、
# 「変更なし」を確認できなくなる。
variable "final_snapshot_identifier" {
  description = "Name of the final snapshot taken on destroy. Must be set while the instance exists (read from state at destroy time), and must be unique per stop/start cycle"
  type        = string
  default     = null

  # AWS のスナップショット識別子は「英字始まり / 英数字とハイフンのみ / 連続ハイフン不可 /
  # ハイフン終わり不可 / 255 字以内」。違反は destroy の瞬間に InvalidParameterValue で
  # 失敗するが、その時点では -var で直せない（上記の落とし穴）ので apply 前に弾く。
  # coalesce で "x" に倒しているのは null（= skip_final_snapshot 側で扱う）を通すため。
  validation {
    condition = (
      can(regex("^[a-zA-Z][a-zA-Z0-9-]{0,254}$", coalesce(var.final_snapshot_identifier, "x"))) &&
      !can(regex("--", coalesce(var.final_snapshot_identifier, "x"))) &&
      !can(regex("-$", coalesce(var.final_snapshot_identifier, "x")))
    )
    error_message = "final_snapshot_identifier は英字で始まり、英数字とハイフンのみ、連続ハイフンとハイフン終わりは不可、255 文字以内にしてください。"
  }
}

# 既存スナップショットから復元する場合にその名前を渡す。null なら空の DB を新規作成。
variable "snapshot_identifier" {
  description = "Restore from this snapshot instead of creating an empty database"
  type        = string
  default     = null
}