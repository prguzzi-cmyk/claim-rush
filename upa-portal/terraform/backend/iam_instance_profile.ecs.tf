resource "aws_iam_instance_profile" "ecs" {
  name = "${var.project_name}-${terraform.workspace}-instance-profile-ecs"
  role = aws_iam_role.ecs.name
  path = "/"

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-instance-profile-ecs"
    logical-id  = "instance-profile-ecs"
    environment = terraform.workspace
    project     = var.project_name
  }
}
