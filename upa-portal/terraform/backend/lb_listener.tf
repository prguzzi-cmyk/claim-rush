resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  depends_on        = [aws_lb_target_group.main]

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}
