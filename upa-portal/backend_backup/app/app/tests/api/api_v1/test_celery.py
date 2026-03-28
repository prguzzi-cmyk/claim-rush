#!/usr/bin/env python

"""Tests for Celery worker"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_celery_worker() -> None:
    data = {"msg": "test"}

    r = client.post(f"{settings.API_V1_STR}/utils/test-celery", json=data)

    response = r.json()

    assert r.status_code == 201
    assert response["msg"] == "Word received"
