resource "aws_ecs_service" "backend" {
  name                 = "backend"
  cluster              = aws_ecs_cluster.default.id
  depends_on           = [aws_lb_listener.main, aws_iam_role_policy.ecs-service]
  desired_count        = 1
  force_new_deployment = true
  task_definition      = "${aws_ecs_task_definition.backend.family}:${data.aws_ecs_task_definition.backend.revision}"
  iam_role             = aws_iam_role.ecs-service.arn

  load_balancer {
    container_name   = "backend"
    container_port   = 80
    target_group_arn = aws_lb_target_group.main.arn
  }
}

resource "aws_ecs_service" "celery-worker" {
  name                 = "celery-worker"
  cluster              = aws_ecs_cluster.default.id
  depends_on           = [aws_iam_role_policy_attachment.ecs]
  desired_count        = 1
  force_new_deployment = true
  task_definition      = "${aws_ecs_task_definition.celery-worker.family}:${data.aws_ecs_task_definition.celery-worker.revision}"
}
