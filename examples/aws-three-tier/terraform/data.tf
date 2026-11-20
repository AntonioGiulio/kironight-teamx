resource "aws_db_subnet_group" "main" {
  name       = "shop-db"
  subnet_ids = [aws_subnet.private.id]
}

resource "aws_db_instance" "orders_db" {
  identifier                  = "shop-orders"
  engine                      = "postgres"
  engine_version              = "16.4"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  multi_az                    = false
  username                    = "shop"
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [aws_security_group.db.id]
  skip_final_snapshot         = true
}

resource "aws_s3_bucket" "assets" {
  bucket_prefix = "shop-assets-"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_sqs_queue" "orders" {
  name = "shop-orders"
}
