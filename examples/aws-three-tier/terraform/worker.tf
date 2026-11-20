resource "aws_iam_role" "worker" {
  name               = "shop-order-worker"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_lambda_function" "order_worker" {
  function_name = "shop-order-worker"
  role          = aws_iam_role.worker.arn
  runtime       = "python3.12"
  handler       = "worker.handler"
  memory_size   = 256
  filename      = "build/worker.zip"

  environment {
    variables = {
      ASSETS_BUCKET = aws_s3_bucket.assets.bucket
    }
  }
}

resource "aws_lambda_event_source_mapping" "orders" {
  event_source_arn = aws_sqs_queue.orders.arn
  function_name    = aws_lambda_function.order_worker.arn
  batch_size       = 10
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/shop-order-worker"
  retention_in_days = 14
}
