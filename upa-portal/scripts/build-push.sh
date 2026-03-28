#!/usr/bin/env bash

# Exit in case of error
set -e

# Build compose services
TAG=${TAG?Variable not set} \
sh ./scripts/build.sh

TAG=${VERSION_TAG?Variable not set} \
sh ./scripts/build.sh

# Push service images
echo "Pushing images..."

TAG=${TAG?Variable not set}
docker compose -f compose.yaml push

TAG=${VERSION_TAG?Variable not set}
docker compose -f compose.yaml push
