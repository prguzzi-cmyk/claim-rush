#!/usr/bin/env python

"""In-App Notification API endpoints"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db_session
from app.crud.crud_in_app_notification import in_app_notification as notification_crud
from app.schemas.in_app_notification import (
    InAppNotification as InAppNotificationSchema,
    UnreadCountResponse,
)
from app import models

router = APIRouter()


@router.get(
    "",
    response_model=list[InAppNotificationSchema],
    summary="Get my notifications",
)
def get_notifications(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    unread_only: Annotated[bool, Query(description="Only return unread notifications")] = False,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> Any:
    """Get notifications for the current user, ordered by most recent first."""
    return notification_crud.get_by_user(
        db_session,
        user_id=current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
def get_unread_count(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the count of unread notifications for the current user."""
    count = notification_crud.get_unread_count(db_session, user_id=current_user.id)
    return {"unread_count": count}


@router.patch(
    "/{notification_id}/read",
    response_model=InAppNotificationSchema,
    summary="Mark notification as read",
)
def mark_as_read(
    notification_id: UUID,
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Mark a single notification as read."""
    notification = notification_crud.mark_as_read(
        db_session,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return notification


@router.patch(
    "/read-all",
    summary="Mark all notifications as read",
)
def mark_all_as_read(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Mark all unread notifications as read for the current user."""
    count = notification_crud.mark_all_as_read(db_session, user_id=current_user.id)
    return {"marked_read": count}
