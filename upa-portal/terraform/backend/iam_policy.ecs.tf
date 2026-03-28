resource "aws_iam_policy" "ecs-task" {
  name        = "${var.project_name}-${terraform.workspace}-iam-policy-ecs-task"
  path        = "/"
  description = "Allow access to S3 bucket"
  policy      = data.aws_iam_policy_document.ecs-task-policy.json
}
