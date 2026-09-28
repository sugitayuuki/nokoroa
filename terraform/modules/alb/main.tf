# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.deletion_protection
  enable_http2               = true

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# Target Group for Backend
resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-${var.environment}-backend-tg"
  port        = var.backend_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/api"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-tg"
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-${var.environment}-frontend-tg"
  port        = var.frontend_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend-tg"
  }
}

# HTTP Listener (redirects to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener (requires SSL certificate)
resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  # TLS 1.3 に対応した現行の推奨ポリシー。旧 ELBSecurityPolicy-TLS-1-2-2017-01 は
  # TLS 1.3 を含まず、利用できる暗号スイートも古い。
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# www -> apex への 301 リダイレクト
# www.<apex> にも A レコードと ACM の SAN があるため www でも到達できてしまうが、
# backend の CORS 許可オリジンは apex 単独のため、www のままだと全 API が CORS で失敗する。
# ALB 側で apex に寄せることで www で来たユーザーも正常に利用できる。
# 優先度は API 転送ルール（100）より小さくし、/api/* を含む全パスに先に効かせる。
resource "aws_lb_listener_rule" "www_redirect" {
  count = var.enable_https && var.apex_domain != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type = "redirect"

    redirect {
      host        = var.apex_domain
      path        = "/#{path}" # #{path} には先頭の "/" が含まれない
      query       = "#{query}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = ["www.${var.apex_domain}"]
    }
  }
}

# HTTP 側にも同じ www -> apex ルールを置く。
# 無いと http://www は「80→443(www) → 443 で apex」と 301 が 2 ホップになる。
resource "aws_lb_listener_rule" "www_redirect_http" {
  count = var.enable_https && var.apex_domain != "" ? 1 : 0

  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type = "redirect"

    redirect {
      host        = var.apex_domain
      path        = "/#{path}" # #{path} には先頭の "/" が含まれない
      query       = "#{query}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = ["www.${var.apex_domain}"]
    }
  }
}

# Listener Rule for Backend API
resource "aws_lb_listener_rule" "backend_api" {
  count = var.enable_https ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# HTTP Listener for development (when no SSL certificate)
resource "aws_lb_listener" "http_dev" {
  count = !var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener Rule for Backend API (HTTP)
resource "aws_lb_listener_rule" "backend_api_http" {
  count = !var.enable_https ? 1 : 0

  listener_arn = aws_lb_listener.http_dev[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}