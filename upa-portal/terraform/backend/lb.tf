resource "aws_lb" "main" {
  name               = "${var.project_name}-${terraform.workspace}-lb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.lb.id]
  subnets = [
    aws_subnet.public_a.id,
    aws_subnet.public_b.id,
  ]

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-lb-main"
    logical-id  = "lb-main"
    environment = terraform.workspace
    project     = var.project_name
  }
}
