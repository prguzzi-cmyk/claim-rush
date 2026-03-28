variable "project_name" {
  description = "Name of the project."
  type        = string
  nullable    = false
}

variable "project_email" {
  description = "Project email address."
  type        = string
  nullable    = false
}

variable "tf_s3_bucket" {
  description = "S3 bucket name for Terraform and project."
  type        = string
  nullable    = false
}

variable "aws_region" {
  description = "Region name for AWS."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID."
  type        = string
  nullable    = false
}

variable "ecr_backend_name" {
  description = "ECR repository name of backend."
  type        = string
  nullable    = false
}

variable "ecr_celery_worker_name" {
  description = "ECR repository name of celery-worker."
  type        = string
  nullable    = false
}

variable "ecr_names" {
  description = "The list of repository names to create in ECR."
  type        = list(string)
  nullable    = false
}

variable "image_mutability" {
  description = "Image mutability for ECR."
  type        = string
  default     = "MUTABLE"
}

variable "encrypt_type" {
  description = "Type of encryption for ECR."
  type        = string
  default     = "KMS"
}

variable "ecs_public_key" {
  description = "Public key for ECS(EC2) SSH."
  type        = string
  nullable    = false
  sensitive   = true
}

variable "db_name" {
  description = "Database name."
  type        = string
  sensitive   = true
}

variable "db_user" {
  description = "Database user."
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password."
  type        = string
  sensitive   = true
}

variable "db_engine_version" {
  description = "Database engine version number."
  type        = string
  default     = "13.7"
  sensitive   = true
}
