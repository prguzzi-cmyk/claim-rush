#!/usr/bin/env bash

# Exit in case of error
set -x

# Remove unused imports and variables
autoflake app

# Formats source code
black app

# Sorts imports
isort app