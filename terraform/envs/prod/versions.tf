terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # random_password（RDS のパスワード生成）で使用
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # state には RDS パスワード・JWT 署名鍵・OAuth シークレットが平文で載る。
  # ローカル state だと暗号化もバージョニングもロックも無い状態で
  # 開発機の作業ツリーに本番クレデンシャルが置かれるため、S3 backend を使う。
  # 参照先はどちらも modules/s3 が作成済み
  # (aws_s3_bucket.terraform_state / aws_dynamodb_table.terraform_state_lock)。
  # backend はブロック内で変数を使えないため、値は直書きする必要がある。
  backend "s3" {
    bucket         = "nokoroa-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "Nokoroa"
      ManagedBy   = "Terraform"
    }
  }
}
