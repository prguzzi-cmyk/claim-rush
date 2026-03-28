#!/usr/bin/env python

"""Reusable helper for creating in-app notifications."""

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.in_app_notification import InAppNotification

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    *,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: str = "system",
    link: str | None = None,
    lead_id: UUID | None = None,
) -> InAppNotification:
    """Create an in-app notification and add it to the session.

    Does NOT commit — the caller is responsible for committing the transaction.
    """
    notification = InAppNotification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        lead_id=lead_id,
    )
    db.add(notification)
    logger.info(
        "In-app notification created: user=%s type=%s title=%s",
        user_id, notification_type, title,
    )
    return notification
