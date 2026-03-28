#!/usr/bin/env python

"""SQLAlchemy model for in-app notifications"""

from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class InAppNotification(TimestampMixin, Base):
    """Persistent in-app notification delivered to a user."""

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_notification_user_id", ondelete="CASCADE"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notification_type: Mapped[str] = mapped_column(
        String(30), default="lead_assignment",
    )  # lead_assignment, system, etc.
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    read_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Optional references
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("lead.id", name="fk_notification_lead_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined", viewonly=True)
    lead = relationship("Lead", foreign_keys=[lead_id], lazy="joined", viewonly=True)

    __table_args__ = (
        Index("ix_notification_user_read", "user_id", "is_read"),
    )

    def __repr__(self) -> str:
        return (
            f"InAppNotification(id={self.id!r}, "
            f"user_id={self.user_id!r}, "
            f"title={self.title!r}, "
            f"is_read={self.is_read!r})"
        )
