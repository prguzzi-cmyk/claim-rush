#!/usr/bin/env python

"""SQLAlchemy model for rotation lead activity (audit trail)"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import User
    from app.models.rotation_lead import RotationLead


class RotationLeadActivity(TimestampMixin, Base):
    """Immutable audit log entry for a rotation lead."""

    rotation_lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "rotation_lead.id",
            name="fk_rotation_lead_activity_lead_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    activity_type: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_rotation_lead_activity_performed_by_id",
        ),
        nullable=True,
    )

    # Relationships
    rotation_lead: Mapped["RotationLead"] = relationship(
        back_populates="activities",
        lazy="joined",
    )
    performed_by: Mapped["User | None"] = relationship(
        foreign_keys=[performed_by_id],
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"activity_type={self.activity_type!r})"
        )
