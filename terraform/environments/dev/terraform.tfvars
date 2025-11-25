environment = "dev"
aws_region  = "ap-northeast-1"

# Database settings
db_password = "changeme123!" # 実際の運用では環境変数やSecrets Managerを使用

# Application settings
jwt_secret = "your-jwt-secret-key-here" # 実際の運用では環境変数やSecrets Managerを使用

# Docker images (ECRを使用する場合はここに設定)
backend_image  = ""
frontend_image = ""