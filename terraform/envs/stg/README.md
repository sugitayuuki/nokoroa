# ステージング環境（未実装）

コスト上の理由から実際には構築しておらず、`.tf` は置いていません。実装するなら `prod/` をベースに以下を変える方針です。

| 項目 | prod | stg の方針 |
|---|---|---|
| RDS | `db.t4g.micro` / 削除保護なし / 最終スナップショットで保護 / バックアップ 14 日 | 同クラス / バックアップ 1 日 / `skip_final_snapshot = true`。壊して作り直せることを優先 |
| ECS | backend・frontend 各 1 タスク | 同数。`desired_count` を 0 にして普段は停止 |
| ALB | HTTPS（ACM 証明書） | prod と同じ証明書のサブドメイン（`stg.` プレフィックス）を追加 |
| Secrets | `recovery_window` 既定 30 日 | `recovery_window_in_days = 0`。作り直しを繰り返すため（※ この変数は `modules/secrets` に未実装。追加が必要） |
| ログ保持 | 30 日 | 7 日 |
| 稼働の切り替え | `runtime_enabled` 変数 | 同じ仕組みを流用できる（空の DB で作り直すので `start_from_empty = true` の明示が必要） |

`prod/` との差分が上記に収まるよう、環境固有の値は `variables.tf` 経由にしてあります。**ただし次の 2 点はモジュール側の変更が必要**で、`variables.tf` では吸収できません。

- **`prevent_destroy`**: `modules/secrets` の `jwt_secret` と `modules/s3` の `uploads` に入っており、そのままでは `terraform destroy` が plan 段階で止まります（`lifecycle` は変数で解除できない）。共有モジュールなので、本文をその場で編集すると prod のガードも同時に外れます。扱いは `terraform/README.md`「運用上の落とし穴」を参照
- **`recovery_window_in_days`**: この変数が `modules/secrets` に未実装です
