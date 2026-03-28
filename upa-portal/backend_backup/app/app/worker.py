#!/usr/bin/env python

from app.core.celery_app import celery_app

# TODO sentry-sdk[fastapi]


@celery_app.task(acks_late=True)
def test_celery(word: str) -> str:
    return f"Test task return {word}"
