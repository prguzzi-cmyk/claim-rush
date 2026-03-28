resource "aws_iam_role_policy" "ecs-service" {
  name   = "${var.project_name}-${terraform.workspace}-role-policy-ecs-service"
  policy = data.aws_iam_policy_document.ecs-service.json
  role   = aws_iam_role.ecs-service.id
}

resource "aws_iam_role_policy" "ecs-instance" {
  name   = "${var.project_name}-${terraform.workspace}-role-policy-ecs-instance"
  policy = data.aws_iam_policy_document.ecs-instance.json
  role   = aws_iam_role.ecs.id
}
