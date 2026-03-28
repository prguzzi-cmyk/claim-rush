#!/usr/bin/env bash

# Exit in case of error
set -x

# Execute prestart script
bash ./prestart.sh

# Start Uvicorn server
uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
