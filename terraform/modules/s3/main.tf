# S3 Bucket for uploads
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-${var.environment}-uploads"

  tags = {
    Name        = "${var.project_name}-${var.environment}-uploads"
    Environment = var.environment
  }

  # 投稿画像の実データが入っており、消すと復旧できない。destroy の plan は 1 件でも
  # prevent_destroy に当たれば全体が reject されるので、ここ 1 件でこのモジュールごとの
  # destroy が止まる。作り直しを前提とする環境ではこのブロックを外して使う
  # （lifecycle は literal しか取れず変数で解除できない）。
  #
  # terraform_state バケットには付けない。count を持つため、count が 1 → 0 になる
  # （= create_terraform_state_bucket を false に倒す）経路が解除不能な plan エラーになる。
  lifecycle {
    prevent_destroy = true
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Public Access Block
# 投稿画像は public/* をバケットポリシーで公開配信しているため、ポリシー側の
# 2 つ (block_public_policy / restrict_public_buckets) は有効にできない。
# 一方 ACL は一切使っていない (アップロード時に ACL を指定していない) ので、
# ACL 側の 2 つは閉じて、オブジェクト単位で公開範囲を広げられないようにする。
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket Policy for public read access (for uploaded images)
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/public/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# S3 Bucket for Terraform state (optional)
resource "aws_s3_bucket" "terraform_state" {
  count  = var.create_terraform_state_bucket ? 1 : 0
  bucket = "${var.project_name}-terraform-state"

  tags = {
    Name        = "${var.project_name}-terraform-state"
    Environment = "global"
  }

}

resource "aws_s3_bucket_versioning" "terraform_state" {
  count  = var.create_terraform_state_bucket ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  count  = var.create_terraform_state_bucket ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  count  = var.create_terraform_state_bucket ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_state_lock" {
  count        = var.create_terraform_state_bucket ? 1 : 0
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "terraform-state-lock"
    Environment = "global"
  }
}