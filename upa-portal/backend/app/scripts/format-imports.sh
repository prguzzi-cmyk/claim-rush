#!/usr/bin/env bash

# Exit in case of error
set -x

# Sort imports one per line, so autoflake can remove unused imports
isort --force-single-line-imports app

# Call format shell script
bash ./scripts/format.sh