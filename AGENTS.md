# Nokoroa - Claude Code Instructions

## Project Structure

- `nokoroa-frontend/` - Next.js frontend
- `nokoroa-backend/` - NestJS backend
- `terraform/` - Infrastructure as Code

## 開発ルール

- コード修正時にbuildはしないで
- 実装時に作成された不要なログとコメントは必ず消して(既存のログは絶対に消さないで、実装時にログが作成されないならこの条件は無視して)
- 実装時に必ずコミットはしないようにして
- リモートの変更はpullしないで
- DBの中身やマイグレーションをリセットしないで

## Environment

### Local Development
- Backend: http://localhost:4000
- Frontend: http://localhost:3000
- Database: PostgreSQL on localhost:5432

### Production
- AWS ECS Fargate
- RDS PostgreSQL
- S3 for file uploads
- Terraform managed infrastructure

