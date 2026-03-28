#!/usr/bin/env python

"""SQLAlchemy model for the fire_incident table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import FireAgency, Lead
    from app.models.rin_source import RinSource

# Valid dispatch_status values:
#   "active"   – currently on active dispatch (units responding / on scene)
#   "cleared"  – units cleared / incident closed by dispatch source
#   "archived" – explicitly archived by admin or retention policy
DISPATCH_STATUS_ACTIVE = "active"
DISPATCH_STATUS_CLEARED = "cleared"
DISPATCH_STATUS_ARCHIVED = "archived"


class FireIncident(TimestampMixin, Base):
    pulsepoint_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    call_type: Mapped[str] = mapped_column(String(20))
    call_type_description: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    received_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    units: Mapped[str | None] = mapped_column(Text)  # JSON-encoded list of unit IDs

    # Dispatch lifecycle status — incidents are NEVER deleted.
    # "active" = on dispatch, "cleared" = closed by source, "archived" = admin/retention
    dispatch_status: Mapped[str] = mapped_column(
        String(20), default=DISPATCH_STATUS_ACTIVE, index=True
    )

    # Legacy column kept for backward compatibility with existing queries and
    # frontend clients.  Derived from dispatch_status:
    #   active → True,  cleared/archived → False
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamp when the incident cleared from active dispatch (units cleared).
    # NULL means still on active dispatch or never tracked.
    cleared_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Auto-lead rotation audit fields
    auto_lead_attempted: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_lead_skipped_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Multi-source fields
    data_source: Mapped[str] = mapped_column(String(20), default="pulsepoint", index=True)
    external_id: Mapped[str | None] = mapped_column(String(200), index=True, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # RIN Source FK
    source_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "rin_source.id",
            name="fk_fire_incident_source_id",
        ),
        nullable=True,
        index=True,
    )

    # Foreign Keys
    agency_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "fire_agency.id",
            name="fk_fire_incident_agency_id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_fire_incident_lead_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint(
            "pulsepoint_id",
            "agency_id",
            name="uq_fire_incident_pulsepoint_agency",
        ),
        UniqueConstraint(
            "data_source",
            "external_id",
            name="uq_fire_incident_source_external",
        ),
    )

    # Relationships
    source: Mapped["RinSource | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )
    agency: Mapped["FireAgency | None"] = relationship(
        back_populates="incidents",
        lazy="joined",
        viewonly=True,
    )
    lead: Mapped["Lead | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"data_source={self.data_source!r}, "
            f"external_id={self.external_id!r}, "
            f"call_type={self.call_type!r})"
        )
