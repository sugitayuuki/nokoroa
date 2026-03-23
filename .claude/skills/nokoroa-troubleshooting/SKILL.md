---
name: nokoroa-troubleshooting
description: "Nokoroa開発でよくある問題と解決方法（Docker・Prisma・認証・ビルド・ECS・ブラウザテスト関連）。Use when: (1) エラーが発生した時、(2) 動作がおかしい時、(3) ユーザーが「動かない」「エラーが出る」「トラブルシューティングして」と報告した場合。"
---

# Nokoroa トラブルシューティング

## 問題一覧

| # | 症状 | 原因 | 解決 |
|---|------|------|------|
| 1 | `Cannot start service: port is already allocated` | ポート競合（4000/5432/3000） | `lsof -i :4000` → `kill -9 <PID>` → `docker-compose up -d` |
| 2 | `P1001: Can't reach database server` | PostgreSQL未起動 / 接続情報不正 | `docker-compose up -d postgres` → `.env` の `DATABASE_URL` 確認 |
| 3 | `Prisma Client out of sync` / `Unknown field` | スキーマ変更後にgenerate未実行 | `cd nokoroa-backend && npx prisma generate && npm run start:dev` |
| 4 | `Migration failed` | マイグレーション競合 / DB状態不整合 | `npx prisma migrate dev --name fix` で新規マイグレーション生成、既存DBを修正 |
| 5 | `401 Unauthorized` | JWT期限切れ / トークン未設定 | 再ログインしてトークン再取得。`localStorage.getItem('token')` で確認 |
| 6 | `CORS error` | Backend CORS設定不正 / API URLの末尾スラッシュ | `.env` の `FRONTEND_URL` 確認。API URLに末尾 `/` がないこと確認 |
| 7 | `next build` でlintエラー | import順序 / 未使用変数 | `npm run lint -- --fix` で自動修正。`simple-import-sort` の場合は空行を追加 |
| 8 | ECSタスクがUNHEALTHY | ヘルスチェック失敗 / アーキテクチャ不一致 | ARM64でビルドしているか確認。ログ確認: `aws logs tail "/ecs/nokoroa-prod/frontend" --since 10m --region ap-northeast-1` |
| 9 | ECS `force-new-deployment` しても古いイメージ | タスク定義のイメージタグが固定 | タスク定義を新リビジョンで登録してからサービス更新（`/nokoroa-deploy` 参照） |
| 10 | `Module not found: Can't resolve '@/...'` | Next.js パスエイリアス設定不正 | `tsconfig.json` の `paths` 設定確認。`npm install` で依存解決 |

## Docker関連

```bash
# Docker完全リセット
cd nokoroa-backend && docker-compose down -v && docker-compose up -d

# コンテナ状態確認
docker ps
docker-compose logs -f

# ポート確認
lsof -i :4000  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :3000  # Frontend
```

## ECS関連

```bash
# サービス状態
aws ecs describe-services --cluster nokoroa-prod-cluster \
  --services nokoroa-prod-backend nokoroa-prod-frontend \
  --region ap-northeast-1 \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}'

# 直近イベント（エラー原因）
aws ecs describe-services --cluster nokoroa-prod-cluster \
  --services nokoroa-prod-frontend \
  --region ap-northeast-1 \
  --query 'services[0].events[0:5]'

# タスクのヘルス状態
aws ecs list-tasks --cluster nokoroa-prod-cluster --region ap-northeast-1
aws ecs describe-tasks --cluster nokoroa-prod-cluster --tasks <TASK_ID> \
  --region ap-northeast-1 \
  --query 'tasks[0].{lastStatus:lastStatus,healthStatus:healthStatus}'

# ログ確認
aws logs tail "/ecs/nokoroa-prod/backend" --since 10m --region ap-northeast-1
aws logs tail "/ecs/nokoroa-prod/frontend" --since 10m --region ap-northeast-1
```

## ブラウザテスト固有の問題

| 症状 | 解決 |
|------|------|
| ページが完全にロードされない | `computer(action: "wait", duration: 5)` → `read_console_messages(onlyErrors: true)` |
| 要素が見つからない | `read_page` で現在のページ構造を再確認 → `find(query: "<探したい要素>")` |
| タブIDが無効 | `tabs_context_mcp` でタブ情報を再取得 |
| ネットワークエラー | `read_network_requests(urlPattern: "/api/")` で失敗リクエストを確認 |
| 認証エラー (ブラウザ) | `javascript_tool(text: "localStorage.getItem('token')")` でトークン確認 |
