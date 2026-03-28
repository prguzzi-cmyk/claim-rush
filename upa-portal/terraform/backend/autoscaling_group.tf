resource "aws_autoscaling_group" "ecs" {
  name                      = "${var.project_name}-${terraform.workspace}-autoscaling-group-ecs"
  max_size                  = 2
  min_size                  = 1
  desired_capacity          = 1
  launch_configuration      = aws_launch_configuration.ecs.name
  health_check_grace_period = 120
  default_cooldown          = 30
  health_check_type         = "EC2"
  vpc_zone_identifier = [
    aws_subnet.public_a.id,
    aws_subnet.public_b.id,
  ]
  target_group_arns    = [aws_lb_target_group.main.arn]
  termination_policies = ["OldestInstance"]

  lifecycle {
    create_before_destroy = true
  }

  tag {
    key                 = "Name"
    propagate_at_launch = true
    value               = "${var.project_name}-${terraform.workspace}-autoscaling-group-ecs"
  }

  tag {
    key                 = "logical-id"
    propagate_at_launch = true
    value               = "autoscaling-group-ecs"
  }

  tag {
    key                 = "environment"
    propagate_at_launch = true
    value               = terraform.workspace
  }

  tag {
    key                 = "project"
    propagate_at_launch = true
    value               = var.project_name
  }
}
