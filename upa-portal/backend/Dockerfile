# Railway-compatible Dockerfile for UPA/ACI FastAPI backend
FROM python:3.11-bullseye AS requirements-stage
WORKDIR /tmp
RUN pip install poetry==1.8.2
COPY ./app/pyproject.toml ./app/poetry.lock* /tmp/
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

FROM python:3.11-bullseye
WORKDIR /app
COPY --from=requirements-stage /tmp/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt
COPY ./app /app
ENV PYTHONPATH=/app
ENV PORT=8000
RUN chmod +x ./prestart.sh && chmod +x ./scripts/*
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
