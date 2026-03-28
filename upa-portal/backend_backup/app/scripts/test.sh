#!/usr/bin/env bash

# Exit in case of error
set -e

# Debugging for the current shell session
set -x

# Execute coverage.py and run pytest
coverage run -m pytest app/tests "${@}"

# Analysis the code
coverage report
