resource "aws_ecr_repository" "default" {
  for_each             = toset(var.ecr_names)
  name                 = each.key
  image_tag_mutability = var.image_mutability

  encryption_configuration {
    encryption_type = var.encrypt_type
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

output "repository_url" {
  description = "The URL of the repository"
  value       = { for k, v in aws_ecr_repository.default : k => v.repository_url }
}
