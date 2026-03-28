resource "aws_ecs_task_definition" "backend" {
  container_definitions = templatefile("${path.module}/container_definitions/backend.json.tftpl", {
    aws_account_id = var.aws_account_id,
    aws_region     = var.aws_region,
    bucket_name    = var.tf_s3_bucket,
    tag            = terraform.workspace,
    image_name     = var.ecr_backend_name,
    log_group      = aws_cloudwatch_log_group.backend.name
  })
  family                   = "backend"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs-task.arn
  depends_on               = [aws_db_instance.default]
}

resource "aws_ecs_task_definition" "celery-worker" {
  container_definitions = templatefile("${path.module}/container_definitions/celery_worker.json.tftpl", {
    aws_account_id = var.aws_account_id,
    aws_region     = var.aws_region,
    bucket_name    = var.tf_s3_bucket,
    tag            = terraform.workspace,
    image_name     = var.ecr_celery_worker_name,
  })
  family                   = "celery-worker"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs-task.arn
  depends_on               = [aws_db_instance.default]
}
