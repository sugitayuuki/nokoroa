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
# 落とし穴: この値は destroy 時に **state から** 読まれる。destroy と同じコマンドで
# `-var` に渡しても、破棄されるリソースへ新しい設定値は適用されないため無視される。
# したがって **インスタンスが存在するうちの apply で state へ入れておく**必要がある。
#
# timestamp() で自動生成しない理由: 毎回値が変わるため plan に差分が出続け、
# 「変更なし」を確認できなくなる。
variable "final_snapshot_identifier" {
  description = "Name of the final snapshot taken on destroy. Must be set while the instance exists (read from state at destroy time), and must be unique per stop/start cycle"
  type        = string
  default     = null

  # AWS の識別子規則「英字始まり / 英数字とハイフンのみ / 連続ハイフン不可 /
  # ハイフン終わり不可 / 255 字以内」を 1 本の正規表現で表す（(-?[a-z0-9])* の形なので
  # ハイフンは連続せず末尾にも来ない）。違反は destroy の瞬間に InvalidParameterValue で
  # 失敗するが、その時点では -var で直せない（上記の落とし穴）ので apply 前に弾く。
  #
  # 大文字を許さないのは、AWS が識別子を小文字化して保存するため。許すと
  # (1) state の値と AWS 上の実名が食い違い、(2) 下の precondition の != が大小を区別するので
  # 同一スナップショットを別名と誤認して同名衝突の検知をすり抜ける。
  #
  # || ではなく三項を使うのは、|| が短絡せず length(null) で落ちるため。
  validation {
    condition = var.final_snapshot_identifier == null ? true : (
      can(regex("^[a-z](-?[a-z0-9])*$", var.final_snapshot_identifier)) &&
      length(var.final_snapshot_identifier) <= 255
    )
    error_message = "final_snapshot_identifier は小文字英字で始まり、小文字英数字とハイフンのみ、連続ハイフンとハイフン終わりは不可、255 文字以内にしてください（AWS が識別子を小文字化するため大文字は許可しません）。"
  }
}

# 空の DB から始めることを明示するフラグ。既定を false にしているのは、
# snapshot_identifier の渡し忘れで空の DB が本番として立つのを防ぐため（main.tf の
# precondition 参照）。初回構築や意図的な初期化のときだけ true にする。
variable "start_from_empty" {
  description = "Create an empty database instead of restoring from a snapshot. Must be set explicitly so a forgotten snapshot_identifier cannot silently produce an empty production database"
  type        = bool
  default     = false
}

# 既存スナップショットから復元する場合にその名前を渡す。null なら空の DB を新規作成。
variable "snapshot_identifier" {
  description = "Restore from this snapshot instead of creating an empty database"
  type        = string
  default     = null
}
