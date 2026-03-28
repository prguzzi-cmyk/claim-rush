resource "aws_launch_configuration" "ecs" {
  name_prefix                 = "${var.project_name}-${terraform.workspace}-launch-config-ecs"
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ecs.name
  image_id                    = data.aws_ami.ecs.id
  instance_type               = "t2.micro"
  key_name                    = aws_key_pair.ecs.key_name
  security_groups             = [aws_security_group.ecs.id]
  user_data = templatefile("${path.module}/scripts/user_data.sh", {
    ecs_cluster_name = "${var.project_name}-${terraform.workspace}"
  })

  lifecycle {
    create_before_destroy = true
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp2"
  }
}
