#!/usr/bin/env bash

# Exit in case of error
set -x

# Static type checker
mypy app

# Formats source code (Check only)
black app --check

# Sorts imports (Check only)
isort app --check

# Style Guide Enforcement
flake8 app