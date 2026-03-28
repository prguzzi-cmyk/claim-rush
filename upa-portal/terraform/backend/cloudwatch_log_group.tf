resource "aws_cloudwatch_log_group" "backend" {
  name = "${var.project_name}-${terraform.workspace}-cw-lg-backend"

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}"
    logical-id  = "${var.project_name}-${terraform.workspace}-cw-lg-backend"
    environment = terraform.workspace
    project     = var.project_name
  }
}
