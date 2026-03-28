resource "aws_key_pair" "ecs" {
  key_name   = var.project_name
  public_key = var.ecs_public_key

  tags = {
    Name       = "${var.project_name}-key-pair-ecs"
    logical-id = "key-pair-ecs"
    project    = var.project_name
    Email      = var.project_email
  }
}
