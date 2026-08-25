# Diagnost AI — AWS deployment (ECS Fargate + RDS + S3)
#
# Provisions: VPC, RDS Postgres, S3 buckets, ECS Fargate services
# (api, consumer, notifier, dashboard, pr-bot) and single-node
# ClickHouse + Redpanda tasks with EBS-backed volumes.
#
# usage:
#   terraform init
#   terraform plan -var="key_name=my-key" -var="image_tag=v0.1.0"

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "region" { default = "us-east-1" }
variable "environment" { default = "prod" }
variable "key_name" { type = string }
variable "image_tag" { default = "latest" }
variable "container_registry" { description = "ECR registry URL (account.dkr.ecr.region.amazonaws.com)" }

provider "aws" { region = var.region }

locals {
  name = "diagnost-${var.environment}"
  tags = { Project = "diagnost-ai", Environment = var.environment }
}

# ── networking ──────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = merge(local.tags, { Name = local.name })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = local.tags
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 101}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = merge(local.tags, { Name = "${local.name}-public" })
}

data "aws_availability_zones" "available" { state = "available" }

resource "aws_internet_gateway" "main" { vpc_id = aws_vpc.main.id }

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route { cidr_block = "0.0.0.0/0", gateway_id = aws_internet_gateway.main.id }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = local.tags
}

resource "aws_eip" "nat" { domain = "vpc" }

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route { cidr_block = "0.0.0.0/0", nat_gateway_id = aws_nat_gateway.main.id }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── data stores ─────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_instance" "postgres" {
  identifier             = local.name
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  db_name                = "diagnost"
  username               = "diagnost"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.data.id]
  skip_final_snapshot    = var.environment != "prod"
  backup_retention_period = 7
  tags                   = local.tags
}

resource "aws_s3_bucket" "transcripts" {
  bucket = "${local.name}-transcripts"
  tags   = local.tags
}

resource "aws_s3_bucket" "finetune" {
  bucket = "${local.name}-finetune"
  tags   = local.tags
}

resource "aws_s3_bucket" "eval_artifacts" {
  bucket = "${local.name}-eval"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = { t = aws_s3_bucket.transcripts, f = aws_s3_bucket.finetune, e = aws_s3_bucket.eval_artifacts }
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── security groups ─────────────────────────────────────────────────
resource "aws_security_group" "services" {
  vpc_id = aws_vpc.main.id
  egress { cidr_blocks = ["0.0.0.0/0"], from_port = 0, to_port = 0, protocol = "-1" }
  tags   = local.tags
}

resource "aws_security_group" "data" {
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.services.id]
  }
  tags = local.tags
}

resource "aws_security_group" "alb" {
  vpc_id = aws_vpc.main.id
  ingress { cidr_blocks = ["0.0.0.0/0"], from_port = 443, to_port = 443, protocol = "tcp" }
  egress { security_groups = [aws_security_group.services.id], from_port = 0, to_port = 0, protocol = "-1" }
  tags   = local.tags
}

# ── load balancer ───────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = local.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = local.tags
}

resource "aws_lb_target_group" "dashboard" {
  port     = 3100
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  health_check { path = "/", matcher = "200" }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dashboard.arn
  }
}

# ── ECS cluster + services ──────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = local.name
  setting { name = "containerInsights", value = "enabled" }
  tags = local.tags
}

locals {
  # stateless services behind the ALB or internal-only
  services = {
    api       = { port = 4100, cpu = 512, memory = 1024, count = 2, public = false }
    consumer  = { port = 0, cpu = 512, memory = 1024, count = 1, public = false }
    notifier  = { port = 0, cpu = 256, memory = 512, count = 1, public = false }
    dashboard = { port = 3100, cpu = 512, memory = 1024, count = 2, public = true }
    "pr-bot"  = { port = 0, cpu = 256, memory = 512, count = 1, public = false }
  }
}

variable "db_password" { type = string, sensitive = true }
variable "acm_certificate_arn" { type = string }

resource "aws_ecs_task_definition" "svc" {
  for_each           = local.services
  family             = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode       = "awsvpc"
  cpu                = each.value.cpu
  memory             = each.value.memory
  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${var.container_registry}/diagnost-${each.key}:${var.image_tag}"
      essential = true
      portMappings = each.value.port > 0 ? [{ containerPort = each.value.port }] : []
      environment = [
        { name = "DATABASE_URL", value = "postgres://diagnost:${var.db_password}@${aws_db_instance.postgres.endpoint}:5432/diagnost" },
        { name = "S3_ENDPOINT", value = "https://s3.${var.region}.amazonaws.com" },
        { name = "S3_BUCKET_TRANSCRIPTS", value = aws_s3_bucket.transcripts.bucket },
        { name = "NODE_ENV", value = "production" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group" = "/ecs/${local.name}"
          "awslogs-region" = var.region
          "awslogs-stream-prefix" = each.key
        }
      }
    }
  ])
}

resource "aws_cloudwatch_log_group" "ecs" {
  name = "/ecs/${local.name}"
  retention_in_days = 30
  tags = local.tags
}

resource "aws_ecs_service" "svc" {
  for_each        = local.services
  name            = "${local.name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.svc[each.key].arn
  desired_count   = each.value.count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.services.id]
  }

  dynamic "load_balancer" {
    for_each = each.value.public ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.dashboard.arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  depends_on = [aws_lb_listener.https]
}

# ── IAM ─────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

output "alb_dns" { value = aws_lb.main.dns_name }
output "rds_endpoint" { value = aws_db_instance.postgres.address }
output "s3_transcripts" { value = aws_s3_bucket.transcripts.bucket }
