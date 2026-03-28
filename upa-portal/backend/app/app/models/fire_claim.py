#!/usr/bin/env python

"""Fire Claim Model"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_project import EstimateProject


class FireClaim(TimestampMixin, AuditMixin, Base):
    """Model for fire damage claim intake."""

    claim_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    loss_date: Mapped[Date] = mapped_column(Date, nullable=False)

    # Property address
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    zip: Mapped[str] = mapped_column(String(10), nullable=False)

    # Insured info
    insured_name: Mapped[str] = mapped_column(String(200), nullable=False)
    insured_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    insured_email: Mapped[str] = mapped_column(String(200), nullable=False)

    # Carrier info
    carrier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    policy_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    carrier_adjuster_email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Fire questionnaire
    origin_area: Mapped[str] = mapped_column(String(30), nullable=False)
    origin_area_other: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rooms_affected: Mapped[str] = mapped_column(Text, nullable=False)
    smoke_level: Mapped[str] = mapped_column(String(20), nullable=False)
    water_from_suppression: Mapped[bool] = mapped_column(Boolean, default=False)
    roof_opened_by_firefighters: Mapped[bool] = mapped_column(Boolean, default=False)
    power_shut_off: Mapped[bool] = mapped_column(Boolean, default=False)

    # Additional
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False)

    # AI analysis
    ai_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_analysis_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Carrier report
    carrier_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    carrier_report_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Estimate link
    estimate_project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_fire_claim_estimate_project_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        unique=True,
    )

    # Relationships
    estimate_project: Mapped["EstimateProject | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )
    media = relationship(
        "FireClaimMedia",
        back_populates="fire_claim",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<FireClaim(id={self.id}, insured_name={self.insured_name}, status={self.status})>"
