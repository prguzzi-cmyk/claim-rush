resource "aws_subnet" "private_a" {
  vpc_id                  = aws_vpc.main.id
  availability_zone       = "${var.aws_region}a"
  cidr_block              = "10.0.2.0/24"
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-subnet-private-${var.aws_region}a"
    logical-id  = "subnet-private-${var.aws_region}a"
    environment = terraform.workspace
    project     = var.project_name
  }
}

resource "aws_subnet" "private_b" {
  vpc_id                  = aws_vpc.main.id
  availability_zone       = "${var.aws_region}b"
  cidr_block              = "10.0.3.0/24"
  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-${terraform.workspace}-subnet-private-${var.aws_region}b"
    logical-id  = "subnet-private-${var.aws_region}b"
    environment = terraform.workspace
    project     = var.project_name
  }
}
