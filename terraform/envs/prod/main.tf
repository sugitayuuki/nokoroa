# ECR Repositories
# runtime_enabled の count を付けていない（停止しても消さない）。リポジトリ自体の保管料は
# 月 $1 程度で、消すと再開のたびに 3 イメージを ARM64 でビルドし直すことになる。
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-frontend"
  }
}

resource "aws_ecr_repository" "ai" {
  name                 = "${var.project_name}-ai"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-ai"
  }
}

resource "aws_ecr_lifecycle_policy" "ai" {
  repository = aws_ecr_repository.ai.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Random Password for RDS
# count も keepers も付けない（停止中も state に残す）。スナップショット内の master
# password は取得時点の値なので、再生成すると AWS CLI やコンソールから直接復元する
# 緊急経路で Secrets Manager の値と食い違う。
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Route 53 Hosted Zone
data "aws_route53_zone" "main" {
  name = var.app_domain
}

# SSL Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = var.app_domain
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.app_domain}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# DNS Validation Records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# Certificate Validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  availability_zones = var.availability_zones
  enable_nat_gateway = false
  frontend_port      = var.frontend_port
  backend_port       = var.backend_port
}

# RDS Module
module "rds" {
  source = "../../modules/rds"
  count  = var.runtime_enabled ? 1 : 0

  project_name            = var.project_name
  environment             = var.environment
  database_subnet_ids     = module.vpc.database_subnet_ids
  rds_security_group_id   = module.vpc.rds_security_group_id
  db_name                 = var.db_name
  db_username             = var.db_username
  db_password             = random_password.db_password.result
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  backup_retention_period = 14

  # 削除保護は使わない。停止のたびに手で true → false へ書き換えて apply する運用になり、
  # その書き換えを忘れた状態で destroy が失敗する形が以前の詰まりだった。
  # データは最終スナップショットで守り、停止は 1 変数で完結させる。
  # 代償として runtime_enabled = false の誤 apply を AWS 側では止められない
  # （最終スナップショットは取られるので復元は可能）。素の terraform destroy への備えは
  # modules/secrets と modules/s3 の prevent_destroy 側にある。
  deletion_protection       = false
  final_snapshot_identifier = var.db_final_snapshot_identifier
  snapshot_identifier       = var.db_snapshot_identifier
  start_from_empty          = var.db_start_from_empty
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  project_name = var.project_name
  environment  = var.environment

  # secrets モジュールには count を付けない（停止しても消さない）。destroy すると
  # recovery_window_in_days 既定の 30 日削除待ちに入り、同名で作り直せない = 再開できない。
  #
  # その結果、常時保持の secrets が条件付きの rds を参照する形になり、停止中は参照先が無い。
  # 停止中だけ無効値になるのは許容できる（この値を読む主体は modules/ecs のタスク定義の
  # valueFrom だけで、停止中はそのタスクが存在しない）。RDS は復元ごとにエンドポイントが
  # 変わりうるので、再開 apply では必ず実値へ書き換わる。
  # .invalid は予約 TLD なので万一参照されても DNS 解決で即失敗する（RFC 2606）。
  #
  # 却下案: secret_version 側に count を付けて停止中はバージョンを消す。最後のバージョンを
  # 削除できるかが API 依存で、空のシークレットを経由すると再開が作成順に依存する。
  db_host              = coalesce(one(module.rds[*].db_instance_address), "rds-not-provisioned.invalid")
  db_port              = 5432
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = random_password.db_password.result
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  gemini_api_key       = var.gemini_api_key

  depends_on = [module.rds]
}

# S3 Module
# runtime_enabled の count を付けていない（停止しても消さない）。投稿画像の実データが
# 入っているため、消すと復旧できない。
module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment
  # 本番バケットにローカル開発用オリジンは許可しない。
  # www は ALB で apex へ 301 されるため通常到達しないが、リダイレクト設定が
  # 外れた場合に画像表示まで巻き添えにしない保険として残している。
  allowed_origins               = ["https://${var.app_domain}", "https://www.${var.app_domain}"]
  create_terraform_state_bucket = true
}

# ALB Module
module "alb" {
  source = "../../modules/alb"
  count  = var.runtime_enabled ? 1 : 0

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.vpc.alb_security_group_id
  backend_port          = var.backend_port
  frontend_port         = var.frontend_port
  certificate_arn       = aws_acm_certificate_validation.main.certificate_arn
  enable_https          = true
  deletion_protection   = false
  apex_domain           = var.app_domain
}

# ECS Module
# count = 0 ではクラスタ・サービス・タスク定義に加えて、このモジュールが抱える
# IAM ロール 2 種と CloudWatch ロググループ 3 種も消える。IAM は再作成が無料、
# ログは保持 30 日のデモ環境なので履歴に価値が薄いと判断し、モジュールごと落とす。
# 停止するとログ履歴が失われる点は README に明記している。
module "ecs" {
  source = "../../modules/ecs"
  count  = var.runtime_enabled ? 1 : 0

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  # Network
  # NAT を置かない構成のため ECS タスクはパブリックサブネットに配置する。
  # private_subnet_ids は ecs モジュールで一度も参照されないため渡していない。
  public_subnet_ids     = module.vpc.public_subnet_ids
  ecs_security_group_id = module.vpc.ecs_security_group_id

  # Application
  backend_image            = var.backend_image
  frontend_image           = var.frontend_image
  ai_image                 = var.ai_image
  allow_placeholder_images = var.allow_placeholder_images
  backend_port             = var.backend_port
  frontend_port            = var.frontend_port
  app_domain               = var.app_domain

  # S3（バケット名は modules/s3 が決めるので output を渡す）
  uploads_bucket_name = module.s3.uploads_bucket_name
  uploads_bucket_arn  = module.s3.uploads_bucket_arn

  # Secrets (from Secrets Manager)
  database_url_secret_arn     = module.secrets.database_url_arn
  jwt_secret_arn              = module.secrets.jwt_secret_arn
  google_client_id_secret_arn = module.secrets.google_client_id_arn
  google_client_secret_arn    = module.secrets.google_client_secret_arn
  gemini_api_key_secret_arn   = module.secrets.gemini_api_key_arn
  internal_api_key_secret_arn = module.secrets.internal_api_key_arn
  secrets_read_policy_arn     = module.secrets.secrets_read_policy_arn

  # ALB
  # [0] で直接引けるのは alb と ecs が同一の runtime_enabled で生死を共にしているため。
  # 片方だけ条件を変えると存在しないインスタンスを参照して落ちる。
  backend_target_group_arn  = module.alb[0].backend_target_group_arn
  frontend_target_group_arn = module.alb[0].frontend_target_group_arn
  backend_lb_listener_arn   = module.alb[0].listener_arn
  frontend_lb_listener_arn  = module.alb[0].listener_arn

  # Scaling
  backend_desired_count  = 1
  frontend_desired_count = 1
  backend_cpu            = 256
  backend_memory         = 512
  frontend_cpu           = 256
  frontend_memory        = 512

  # database_url_secret_arn は secret_version 経由の ARN なので値の書き込みを待つが、
  # 他 5 件（jwt / google×2 / gemini / internal_api_key）の valueFrom はシークレット
  # 本体の ARN を参照しており順序エッジが無い。それだけだとタスク起動が値の書き込みより
  # 先に走り、GetSecretValue が ResourceNotFoundException でタスク起動に失敗する
  # （ECS が再試行するので自己回復はするが、初回起動が遅れ失敗タスクが残る）。
  # モジュール単位で待たせて 7 件すべてを閉じる。
  depends_on = [module.secrets]
}

# Route 53 A Record for ALB
# ALB と生死を共にする。alias レコードは実在するターゲットを必須とするため、ALB を消して
# レコードだけ残すことはできない。ホストゾーン自体は data 参照で Terraform の管理外なので
# ネームサーバは変わらず、停止中は apex の A が引けなくなるだけで済む。
# ACM の DNS 検証レコード（aws_route53_record.cert_validation）は条件を付けていないため
# 残り、証明書は検証済みのまま維持される = 再開時に DNS 検証の待ち時間が発生しない。
resource "aws_route53_record" "alb" {
  count = var.runtime_enabled ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.app_domain
  type    = "A"

  alias {
    name                   = module.alb[0].alb_dns_name
    zone_id                = module.alb[0].alb_zone_id
    evaluate_target_health = true
  }
}

# Route 53 A Record for www subdomain
# www で来たリクエストは ALB のリスナールールで apex へ 301 リダイレクトする
resource "aws_route53_record" "www" {
  count = var.runtime_enabled ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.app_domain}"
  type    = "A"

  alias {
    name                   = module.alb[0].alb_dns_name
    zone_id                = module.alb[0].alb_zone_id
    evaluate_target_health = true
  }
}
