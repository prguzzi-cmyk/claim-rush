#!/usr/bin/env bash

# Exit in case of error
set -e

# Remove possibly previous broken stacks left hanging after an error
docker compose down -v --remove-orphans

# Remove pycache files
if [[ "$(uname -s)" = "Linux" ]] || [[ "$(uname -s)" = "Darwin" ]]; then
  echo "Remove __pycache__ files"
  sudo find . -type d -name __pycache__ -exec rm -r {} \+
fi

# Build and run docker image
docker compose up -d --build

# Start tests
docker compose exec -t backend bash /app/tests-start.sh "$@"
