#!/usr/bin/env bash

# Exit in case of error
set -e

# Build compose services
echo "Building and tagging images..."

TAG=${TAG?Variable not set} \
docker compose -f compose.yaml build
