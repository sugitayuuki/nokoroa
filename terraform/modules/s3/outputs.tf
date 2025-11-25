output "uploads_bucket_name" {
  value = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_regional_domain_name" {
  value = aws_s3_bucket.uploads.bucket_regional_domain_name
}

output "terraform_state_bucket_name" {
  value = var.create_terraform_state_bucket ? aws_s3_bucket.terraform_state[0].id : null
}

output "terraform_state_lock_table_name" {
  value = var.create_terraform_state_bucket ? aws_dynamodb_table.terraform_state_lock[0].name : null
}