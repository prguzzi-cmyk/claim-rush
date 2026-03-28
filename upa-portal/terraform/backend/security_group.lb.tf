resource "aws_security_group" "lb" {
  name        = "${var.project_name}-${terraform.workspace}-security-group-lb"
  description = "HTTP/s access to the public facing load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow from anyone on port 80"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow from anyone on port 443"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All traffic out"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-security-group-lb"
    logical-id  = "security-group-lb"
    environment = terraform.workspace
    project     = var.project_name
  }
}
