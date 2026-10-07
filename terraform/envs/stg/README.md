# ステージング環境（未実装）

コスト上の理由から実際には構築しておらず、`.tf` は置いていません。実装するなら `prod/` をベースに以下を変える方針です。

| 項目 | prod | stg の方針 |
|---|---|---|
| RDS | `db.t4g.micro` / 削除保護なし / 最終スナップショットで保護 / バックアップ 14 日 | 同クラス / バックアップ 1 日 / `skip_final_snapshot = true`。壊して作り直せることを優先 |
| ECS | backend・frontend 各 1 タスク | 同数。`desired_count` を 0 にして普段は停止 |
| ALB | HTTPS（ACM 証明書） | prod と同じ証明書のサブドメイン（`stg.` プレフィックス）を追加 |
| Secrets | `recovery_window` 既定 30 日 | `recovery_window_in_days = 0`。作り直しを繰り返すため（※ この変数は `modules/secrets` に未実装。追加が必要） |
| ログ保持 | 30 日 | 7 日 |
| 稼働の切り替え | `runtime_enabled` 変数 | 同じ仕組みを流用できる |

## 実装前に解消が必要な前提

**`modules/secrets` と `modules/s3` には `prevent_destroy` が入っており、そのままでは stg を `terraform destroy` できません。** `lifecycle` はリテラルしか取れず変数で解除できないため、「壊して作り直す」方針と直接衝突します。該当は 2 箇所です。

- `modules/secrets/main.tf` の `aws_secretsmanager_secret.jwt_secret`
- `modules/s3/main.tf` の `aws_s3_bucket.uploads`

モジュール本文をその場でコメントアウトするのは**避けてください**。共有モジュールなので、作業中は prod のガードも同時に外れます。実装時に選ぶべきは次のどちらかです。

1. 保護対象を prod の `envs/prod/main.tf` 側へ出し、共有モジュールからはガードを外す
2. stg 用に `modules/` をフォークする（重複が増えるので 1 を推奨）

`prod/` との差分が上記に収まるよう、環境固有の値は `variables.tf` 経由にしてあります。ただし上記の `prevent_destroy` と `recovery_window_in_days` の 2 点については**モジュール側の変更が必要**です。
