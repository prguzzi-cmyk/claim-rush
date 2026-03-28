#!/usr/bin/env python

"""SQLAlchemy model for the lead rotation engine"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import User
    from app.models.rotation_lead_activity import RotationLeadActivity


class RotationLead(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    """A lead managed by the rotation engine for round-robin assignment."""

    lead_source: Mapped[str] = mapped_column(String(100))
    property_address: Mapped[str] = mapped_column(String(255))
    property_city: Mapped[str] = mapped_column(String(100))
    property_state: Mapped[str] = mapped_column(String(2))
    property_zip: Mapped[str] = mapped_column(String(10))
    owner_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    incident_type: Mapped[str] = mapped_column(String(50))
    lead_status: Mapped[str] = mapped_column(
        String(30), default="new_lead", index=True
    )
    assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_rotation_lead_assigned_agent_id",
        ),
        nullable=True,
        index=True,
    )
    assignment_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_contact_attempt: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    contact_attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reassignment_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    assigned_agent: Mapped["User | None"] = relationship(
        foreign_keys=[assigned_agent_id],
        lazy="joined",
    )
    activities: Mapped[list["RotationLeadActivity"]] = relationship(
        back_populates="rotation_lead",
        lazy="select",
        order_by="RotationLeadActivity.created_at.desc()",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"owner_name={self.owner_name!r}, "
            f"lead_status={self.lead_status!r})"
        )
