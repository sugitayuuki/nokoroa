output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main.zone_id
}

output "backend_target_group_arn" {
  value = aws_lb_target_group.backend.arn
}

output "frontend_target_group_arn" {
  value = aws_lb_target_group.frontend.arn
}

# リスナーの有無を決めているのは enable_https であって certificate_arn ではない。
# certificate_arn だけを見ると「証明書はあるが enable_https = false」の組み合わせで
# 存在しない https[0] を参照して落ちるため、生成条件と同じ変数で分岐させる。
output "listener_arn" {
  value = var.enable_https ? aws_lb_listener.https[0].arn : aws_lb_listener.http_dev[0].arn
}
