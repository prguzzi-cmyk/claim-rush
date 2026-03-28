resource "aws_db_instance" "default" {
  backup_window             = "03:00-04:00"
  ca_cert_identifier        = "rds-ca-2019"
  db_subnet_group_name      = aws_db_subnet_group.default.name
  vpc_security_group_ids    = [aws_security_group.db.id, aws_security_group.ecs.id]
  engine_version            = var.db_engine_version
  engine                    = "postgres"
  final_snapshot_identifier = "${var.project_name}-${terraform.workspace}"
  identifier                = "${var.project_name}-${terraform.workspace}"
  instance_class            = "db.t3.micro"
  maintenance_window        = "sun:08:00-sun:09:00"
  db_name                   = var.db_name
  parameter_group_name      = "default.postgres13"
  password                  = var.db_password
  username                  = var.db_user
  allocated_storage         = 10
}
