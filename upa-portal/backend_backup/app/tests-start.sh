#!/usr/bin/env bash

# Exit in case of error
set -e

# Boot up base tasks before running tests
python /app/app/tests_pre_start.py

# Run coverage.py and pytest with additional parameters
bash ./scripts/test.sh "$@"