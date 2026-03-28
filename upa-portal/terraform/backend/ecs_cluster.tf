resource "aws_ecs_cluster" "default" {
  name = "${var.project_name}-${terraform.workspace}"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}"
    logical-id  = "ecs-cluster-${terraform.workspace}"
    environment = terraform.workspace
    project     = var.project_name
  }
}
