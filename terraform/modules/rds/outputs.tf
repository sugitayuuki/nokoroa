output "db_instance_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  value = aws_db_instance.main.address
}

output "db_instance_port" {
  value = aws_db_instance.main.port
}

output "db_instance_id" {
  value = aws_db_instance.main.id
}

output "db_name" {
  value = aws_db_instance.main.db_name
}