#!/usr/bin/env python

"""Utility endpoints"""

from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query, status
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app import schemas, crud
from app.api.deps import Permissions, get_db_session
from app.api.deps.role import must_be_superuser
from app.core.celery_app import celery_app
from app.core.rbac import Modules
from app.utils.emails import send_test_email
from app.utils.exceptions import exc_internal_server

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


@router.post(
    "/sync-claim-collaborators",
    summary="Sync Claim Collaborators",
    response_description="Success response",
    response_model=schemas.Msg,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.run())],
)
def sync_claim_collaborators(
    ref_number_start: Annotated[
        int, Query(description="Starting point for claim reference number range.")
    ],
    ref_number_end: Annotated[
        int, Query(description="Ending point for claim reference number range.")
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Synchronize Source, Signer, and other users of claim with collaborators."""

    try:
        return crud.claim.sync_claim_collaborators(
            db_session, ref_number_start, ref_number_end
        )
    except Exception as e:
        raise exc_internal_server(msg=str(e))
