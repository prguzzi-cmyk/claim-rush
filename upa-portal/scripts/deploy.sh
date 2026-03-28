#!/usr/bin/env bash

# Exit in case of error
set -e

# Validate required variables
AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION?Variable not set}
CLUSTER_NAME=${CLUSTER_NAME?Variable not set}
TASK_EXECUTION_ROLE=${TASK_EXECUTION_ROLE?Variable not set}
IMAGE_TAG=${IMAGE_TAG?Variable not set}
DOCKER_IMAGE_BACKEND=${DOCKER_IMAGE_BACKEND?Variable not set}
SERVICE_NAME_BACKEND=${SERVICE_NAME_BACKEND?Variable not set}
TASK_DEFINITION_NAME_BACKEND=${TASK_DEFINITION_NAME_BACKEND?Variable not set}

# Display Backend image with tag
echo "$DOCKER_IMAGE_BACKEND:$IMAGE_TAG"

# Get backend task definition
TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition "$TASK_DEFINITION_NAME_BACKEND" --region "$AWS_DEFAULT_REGION")

# Create new task definition
NEW_CONTAINER_DEFINITION=$(echo "$TASK_DEFINITION" | jq --arg IMAGE "$DOCKER_IMAGE_BACKEND:$IMAGE_TAG" '.taskDefinition.containerDefinitions[0].image = $IMAGE | .taskDefinition.containerDefinitions[0]')

echo "Registering new container definition..."
aws ecs register-task-definition --region "$AWS_DEFAULT_REGION" --family "$TASK_DEFINITION_NAME_BACKEND" --execution-role-arn "$TASK_EXECUTION_ROLE" --container-definitions "$NEW_CONTAINER_DEFINITION"

echo "Updating the service..."
aws ecs update-service --region "$AWS_DEFAULT_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME_BACKEND"  --task-definition "$TASK_DEFINITION_NAME_BACKEND"
