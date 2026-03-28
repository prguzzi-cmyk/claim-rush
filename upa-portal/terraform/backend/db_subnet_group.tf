resource "aws_db_subnet_group" "default" {
  name        = "${var.project_name}-${terraform.workspace}-db-subnet-group"
  description = "RDS subnet group"
  subnet_ids = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id
  ]

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-db-subnet-group"
    logical-id  = "db-subnet-group"
    environment = terraform.workspace
    project     = var.project_name
  }
}
