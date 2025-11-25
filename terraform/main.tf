# ECR Repositories
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

# Random Passwords
resource "random_password" "db_password" {
  length  = 16
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

# AWS Secrets Manager - Database Password
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}-${var.environment}-db-password"
  description = "Database password for RDS PostgreSQL"

  tags = {
    Name = "${var.project_name}-${var.environment}-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = module.rds.db_instance_address
    port     = 5432
    dbname   = var.db_name
  })

  depends_on = [module.rds]
}

# AWS Secrets Manager - JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.project_name}-${var.environment}-jwt-secret"
  description = "JWT secret for authentication"

  tags = {
    Name = "${var.project_name}-${var.environment}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    secret = random_password.jwt_secret.result
  })
}

# Route 53 Hosted Zone
data "aws_route53_zone" "main" {
  name = "nokoroa.com"
}

# SSL Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = "nokoroa.com"
  validation_method = "DNS"

  subject_alternative_names = [
    "*.nokoroa.com"
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
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  availability_zones = var.availability_zones
  enable_nat_gateway = false
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  database_subnet_ids   = module.vpc.database_subnet_ids
  rds_security_group_id = module.vpc.rds_security_group_id
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = random_password.db_password.result
  instance_class        = "db.t4g.micro"
  allocated_storage     = 20
  backup_retention_period = 14
  deletion_protection   = true
}

# S3 Module
module "s3" {
  source = "./modules/s3"

  project_name                  = var.project_name
  environment                   = var.environment
  allowed_origins               = ["http://localhost:3000", "https://nokoroa.com", "https://www.nokoroa.com"]
  create_terraform_state_bucket = true
}

# ALB Module
module "alb" {
  source = "./modules/alb"

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
}

# ECS Module
module "ecs" {
  source = "./modules/ecs"

  project_name      = var.project_name
  environment       = var.environment
  aws_region        = var.aws_region

  # Network
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  public_subnet_ids    = module.vpc.public_subnet_ids
  ecs_security_group_id = module.vpc.ecs_security_group_id
  
  # Database
  db_endpoint = module.rds.db_instance_address
  db_name     = var.db_name
  db_username = var.db_username
  db_password = random_password.db_password.result

  # Application
  backend_image         = var.backend_image
  frontend_image        = var.frontend_image
  backend_port          = var.backend_port
  frontend_port         = var.frontend_port
  jwt_secret           = random_password.jwt_secret.result
  api_domain           = module.alb.alb_dns_name
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  
  # ALB
  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn
  backend_lb_listener_arn   = module.alb.listener_arn
  frontend_lb_listener_arn  = module.alb.listener_arn
  
  # Scaling
  backend_desired_count  = 1
  frontend_desired_count = 1
  backend_cpu           = 256
  backend_memory        = 512
  frontend_cpu          = 256
  frontend_memory       = 512
}

# Route 53 A Record for ALB
resource "aws_route53_record" "alb" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "nokoroa.com"
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

# Route 53 A Record for www subdomain
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.nokoroa.com"
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}