resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-route-table-public"
    logical-id  = "route-table-public"
    environment = terraform.workspace
    project     = var.project_name
  }
}
