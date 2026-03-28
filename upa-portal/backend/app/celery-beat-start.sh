#!/usr/bin/env bash

# Exit in case of error
set -e

# Boot up base tasks before running celery
python /app/app/celery_worker_pre_start.py

# Run celery worker
celery -A app.worker beat -l INFO