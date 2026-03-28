resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-${terraform.workspace}-security-group-ec2"
  description = "Allow all connections coming from it to the public facing load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Rules for SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description     = "Traffic to default ecs port"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.lb.id]
  }

  ingress {
    description     = "All traffic in"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.lb.id]
  }

  egress {
    description = "All traffic out"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-security-group-ec2"
    logical-id  = "security-group-ec2"
    environment = terraform.workspace
    project     = var.project_name
  }
}
