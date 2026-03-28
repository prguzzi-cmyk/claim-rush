resource "aws_iam_role_policy_attachment" "ecs" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
  role       = aws_iam_role.ecs.name
}

resource "aws_iam_role_policy_attachment" "ecs-task" {
  policy_arn = aws_iam_policy.ecs-task.arn
  role       = aws_iam_role.ecs-task.name
}

resource "aws_iam_role_policy_attachment" "ecs-task-execution-role-policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  role       = aws_iam_role.ecs-task.name
}
