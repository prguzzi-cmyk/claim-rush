resource "aws_lb_target_group" "main" {
  name     = "${var.project_name}-${terraform.workspace}-lb-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path = "/"
  }

  stickiness {
    type = "lb_cookie"
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-lb-target-group-main"
    logical-id  = "lb-target-group-main"
    environment = terraform.workspace
    project     = var.project_name
  }
}
