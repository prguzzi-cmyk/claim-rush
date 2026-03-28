#!/usr/bin/env bash

# Exit in case of error
set -e

# Create stack file for compose
DOMAIN=backend \
SMTP_HOST="" \
TRAEFIK_PUBLIC_NETWORK_IS_EXTERNAL=false \
docker compose -f compose.yaml \
config > compose.stack.yaml

# Build and run docker image
docker compose -f compose.stack.yaml build

# Remove possibly previous broken stacks left hanging after an error
docker compose -f compose.stack.yaml down -v --remove-orphans

# Boot up containers
docker compose -f compose.stack.yaml up -d

# Start tests
docker compose -f compose.stack.yaml exec -t backend bash /app/tests-start.sh "$@"

# Remove possibly previous broken stacks left hanging after an error
docker compose -f compose.stack.yaml down -v --remove-orphans
