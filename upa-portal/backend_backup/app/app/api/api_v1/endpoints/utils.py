#!/usr/bin/env python

"""Utility endpoints"""

from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query, status
from pydantic import EmailStr

from app import schemas
from app.api.deps import Permissions
from app.api.deps.role import must_be_superuser
from app.core.celery_app import celery_app
from app.core.rbac import Modules
from app.utils.emails import send_test_email

router = APIRouter()

permissions = Permissions(Modules.UTIL.value)


@router.post(
    "/test-celery",
    summary="Test Celery",
    response_description="Success response",
    response_model=schemas.Msg,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.run())],
)
def test_celery(
    msg: Annotated[schemas.Msg, Body(description="Message for celery worker")]
) -> Any:
    """Test Celery worker"""
    celery_app.send_task("app.worker.test_celery", args=[msg.msg])

    return {"msg": "Word received"}


@router.post(
    "/test-email",
    summary="Test Email",
    response_description="Success response",
    response_model=schemas.Msg,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.run())],
)
def test_email(
    email_to: Annotated[
        EmailStr, Query(description="Email address for the test email")
    ],
    background_task: BackgroundTasks,
) -> Any:
    """Test email server"""
    background_task.add_task(send_test_email, to=email_to)

    return {"msg": "Test email sent"}
