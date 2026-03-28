resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-route-table-private"
    logical-id  = "route-table-private"
    environment = terraform.workspace
    project     = var.project_name
  }
}
