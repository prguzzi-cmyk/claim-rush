resource "aws_security_group" "db" {
  name        = "${var.project_name}-${terraform.workspace}-security-group-db"
  description = "Access to the Postgres DB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow from anyone on port 5432"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    description = "All traffic out"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-security-group-db"
    logical-id  = "security-group-db"
    environment = terraform.workspace
    project     = var.project_name
  }
}
