#!/usr/bin/env python

"""CRUD operations for in-app notifications"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.in_app_notification import InAppNotification
from app.schemas.in_app_notification import (
    InAppNotificationCreate,
    InAppNotificationUpdate,
)


class CRUDInAppNotification(
    CRUDBase[InAppNotification, InAppNotificationCreate, InAppNotificationUpdate]
):
    def get_by_user(
        self,
        db_session: Session,
        *,
        user_id: UUID,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> list[InAppNotification]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.user_id == user_id)
            )
            if unread_only:
                stmt = stmt.where(self.model.is_read == False)
            stmt = (
                stmt.order_by(self.model.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())

    def get_unread_count(self, db_session: Session, *, user_id: UUID) -> int:
        with db_session as session:
            stmt = (
                select(func.count())
                .select_from(self.model)
                .where(
                    self.model.user_id == user_id,
                    self.model.is_read == False,
                )
            )
            return session.execute(stmt).scalar() or 0

    def mark_as_read(self, db_session: Session, *, notification_id: UUID, user_id: UUID) -> InAppNotification | None:
        with db_session as session:
            notification = session.get(self.model, notification_id)
            if not notification or notification.user_id != user_id:
                return None
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            session.add(notification)
            session.commit()
            session.refresh(notification)
            return notification

    def mark_all_as_read(self, db_session: Session, *, user_id: UUID) -> int:
        with db_session as session:
            stmt = (
                update(self.model)
                .where(
                    self.model.user_id == user_id,
                    self.model.is_read == False,
                )
                .values(is_read=True, read_at=datetime.now(timezone.utc))
            )
            result = session.execute(stmt)
            session.commit()
            return result.rowcount


in_app_notification = CRUDInAppNotification(InAppNotification)
