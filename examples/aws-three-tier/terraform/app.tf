resource "aws_lb" "public" {
  name               = "shop-public"
  load_balancer_type = "application"
  internal           = false
  subnets            = [aws_subnet.public.id]
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "api" {
  name        = "shop-api"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecs_cluster" "main" {
  name = "shop"
}

resource "aws_iam_role" "api_task" {
  name               = "shop-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "shop-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([{
    name  = "api"
    image = "public.ecr.aws/example/shop-api:1.4.2"
    portMappings = [{ containerPort = 8080 }]
    environment = [
      { name = "ORDERS_QUEUE_URL", value = aws_sqs_queue.orders.url },
      { name = "ASSETS_BUCKET", value = aws_s3_bucket.assets.bucket },
      { name = "DB_HOST", value = aws_db_instance.orders_db.address },
    ]
  }])
}

resource "aws_ecs_service" "api" {
  name            = "shop-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  desired_count   = 2

  network_configuration {
    subnets         = [aws_subnet.private.id]
    security_groups = [aws_security_group.app.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }
}
