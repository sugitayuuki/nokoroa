# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-${var.environment}/backend"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-logs"
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}-${var.environment}/frontend"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend-logs"
  }
}

resource "aws_cloudwatch_log_group" "ai" {
  name              = "/ecs/${var.project_name}-${var.environment}/ai"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-ai-logs"
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Attach secrets read policy to execution role
resource "aws_iam_role_policy_attachment" "ecs_secrets_read" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = var.secrets_read_policy_arn
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for S3 access
resource "aws_iam_role_policy" "ecs_s3_access" {
  name = "${var.project_name}-${var.environment}-ecs-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.uploads_bucket_arn}/*"
      }
    ]
  })
}

# Backend Task Definition (with AI sidecar)
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu + var.ai_cpu
  memory                   = var.backend_memory + var.ai_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  lifecycle {
    # イメージ未指定のまま本番が立つのを弾く。下の image 行はパブリックの
    # プレースホルダへフォールバックするため、黙って通すと apply は成功して
    # ALB の DNS も返るのに backend は永久に起動しない（ai が python:3.12-slim で
    # HTTP を喋らず dependsOn: HEALTHY を満たせない）。
    precondition {
      condition     = var.allow_placeholder_images || (var.backend_image != "" && var.ai_image != "")
      error_message = "backend_image と ai_image を指定してください（イメージを push する前の初回構築に限り allow_placeholder_images = true）。"
    }
  }

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = var.backend_image != "" ? var.backend_image : "public.ecr.aws/docker/library/node:18-alpine"

      portMappings = [
        {
          containerPort = var.backend_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        },
        {
          name  = "PORT"
          value = tostring(var.backend_port)
        },
        {
          name  = "AWS_BUCKET_NAME"
          value = var.uploads_bucket_name
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        # 環境ごとのドメインは app_domain に一本化している。
        # 以前は非 prod 分岐で ALB の DNS 名を直接使っていたが、ACM 証明書の
        # ドメインと一致せず HTTPS で疎通できないため、必ず証明書と同じ
        # ドメインを渡すこと。
        {
          name  = "GOOGLE_CALLBACK_URL"
          value = "https://${var.app_domain}/api/auth/google/callback"
        },
        {
          name  = "FRONTEND_URL"
          value = "https://${var.app_domain}"
        },
        {
          name  = "AI_SERVICE_URL"
          value = "http://localhost:${var.ai_port}"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.database_url_secret_arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = var.google_client_id_secret_arn
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = var.google_client_secret_arn
        },
        {
          name      = "INTERNAL_AI_TOKEN"
          valueFrom = var.internal_api_key_secret_arn
        }
      ]

      dependsOn = [
        {
          containerName = "ai"
          condition     = "HEALTHY"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.backend_port}/api || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    },
    {
      name      = "ai"
      image     = var.ai_image != "" ? var.ai_image : "public.ecr.aws/docker/library/python:3.12-slim"
      essential = true

      # CORS_ORIGINS は本番では実質機能していない。AI サイドカーは ALB に
      # 紐づかず、同一タスク内の backend から localhost 経由でしか呼ばれないため
      # ブラウザのプリフライトが発生しない。それでも値を明示しているのは、
      # nokoroa-ai/app/config.py の既定値が localhost:3000 / 4000（ローカル開発用）に
      # なっており、未設定のままだと本番タスクが開発用オリジンを許可したまま
      # 起動するため。将来サイドカーを外部公開する場合はここが唯一の指定箇所になる。
      environment = [
        {
          name  = "CORS_ORIGINS"
          value = "http://localhost:${var.backend_port}"
        }
      ]

      secrets = [
        {
          name      = "GEMINI_API_KEY"
          valueFrom = var.gemini_api_key_secret_arn
        },
        {
          name      = "INTERNAL_AI_TOKEN"
          valueFrom = var.internal_api_key_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:${var.ai_port}/health').status==200 else 1)\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])
}

# Frontend Task Definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-${var.environment}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  lifecycle {
    # 理由は backend タスク定義の precondition と同じ。
    precondition {
      condition     = var.allow_placeholder_images || var.frontend_image != ""
      error_message = "frontend_image を指定してください（イメージを push する前の初回構築に限り allow_placeholder_images = true）。"
    }
  }

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = var.frontend_image != "" ? var.frontend_image : "public.ecr.aws/docker/library/node:18-alpine"

      portMappings = [
        {
          containerPort = var.frontend_port
          protocol      = "tcp"
        }
      ]

      # NEXT_PUBLIC_API_URL はここに置かない。
      # Next.js は NEXT_PUBLIC_* をビルド時にバンドルへ埋め込むため、
      # ランタイム env で渡しても効かない（実際に ALB の DNS 名を注入していたが、
      # ACM 証明書と一致せず疎通不能な死に設定だった）。
      # 値の指定は .github/workflows/deploy.yml のビルド引数側に一本化している。
      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.frontend_port}/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# Backend Service
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.backend_target_group_arn
    container_name   = "backend"
    container_port   = var.backend_port
  }

  # デプロイ（GitHub Actions）が :sha タグ付きの新しいタスク定義を登録してサービスへ
  # 適用するため、Terraform が管理する task_definition とは常に差分が出る。
  # 無視しないと次の apply でイメージが古いリビジョンへ巻き戻る。
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [var.backend_lb_listener_arn]
}

# Frontend Service
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-${var.environment}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.frontend_target_group_arn
    container_name   = "frontend"
    container_port   = var.frontend_port
  }

  # backend サービスと同じ理由（deploy.yml が :sha のタスク定義を適用するため）。
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [var.frontend_lb_listener_arn]
}
