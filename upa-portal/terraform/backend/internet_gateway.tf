resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-internet-gateway-main"
    logical-id  = "internet-gateway-main"
    environment = terraform.workspace
    project     = var.project_name
  }
}
