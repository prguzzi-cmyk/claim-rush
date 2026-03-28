#!/usr/bin/env python

"""SQLAlchemy model for the user activity table"""

from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin


class UserActivity(TimestampMixin, AuditMixin, Base):
    timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), default=func.now()
    )
    activity_type: Mapped[str] = mapped_column(String(30))
    related_type: Mapped[str] = mapped_column(String(20))
    details: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_user_activity_user_id", ondelete="CASCADE")
    )

    # Table Configuration
    __mapper_args__ = {
        "polymorphic_identity": "activity",
        "polymorphic_on": "related_type",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"timestamp: {self.timestamp!r}, "
            f"activity_type: {self.activity_type!r}, "
            f"related_type: {self.related_type!r})"
        )
