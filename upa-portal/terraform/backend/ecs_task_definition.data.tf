data "aws_ecs_task_definition" "backend" {
  task_definition = aws_ecs_task_definition.backend.family
}

data "aws_ecs_task_definition" "celery-worker" {
  task_definition = aws_ecs_task_definition.celery-worker.family
}
