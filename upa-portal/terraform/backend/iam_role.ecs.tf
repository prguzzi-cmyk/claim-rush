resource "aws_iam_role" "ecs" {
  name               = "${var.project_name}-${terraform.workspace}-role-ecs"
  description        = "ECS role for ec2"
  assume_role_policy = data.aws_iam_policy_document.ecs.json

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-role-ecs"
    logical-id  = "role-ecs"
    environment = terraform.workspace
    project     = var.project_name
  }
}

resource "aws_iam_role" "ecs-service" {
  name               = "${var.project_name}-${terraform.workspace}-role-ecs-service"
  description        = "ECS Service role for ec2"
  assume_role_policy = data.aws_iam_policy_document.ecs.json

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-role-ecs-service"
    logical-id  = "role-ecs-service"
    environment = terraform.workspace
    project     = var.project_name
  }
}

resource "aws_iam_role" "ecs-task" {
  name               = "${var.project_name}-${terraform.workspace}-role-ecs-task"
  description        = "ECS task role for ec2"
  assume_role_policy = data.aws_iam_policy_document.ecs-task.json

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-role-ecs-task"
    logical-id  = "role-ecs-task"
    environment = terraform.workspace
    project     = var.project_name
  }
}
