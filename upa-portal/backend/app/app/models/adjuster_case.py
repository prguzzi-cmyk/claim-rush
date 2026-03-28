#!/usr/bin/env python

"""Adjuster Case Model — main record for AI Adjuster Assistant workflow."""

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_project import EstimateProject
    from app.models.fire_claim import FireClaim
    from app.models.user import User


class AdjusterCase(TimestampMixin, AuditMixin, Base):
    """7-step AI-assisted claim adjustment workflow."""

    case_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="intake", nullable=False)
    current_step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Optional link to existing fire claim
    fire_claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("fire_claim.id", name="fk_adjuster_case_fire_claim_id", ondelete="SET NULL"),
        nullable=True, unique=True,
    )
    fire_claim: Mapped["FireClaim | None"] = relationship(lazy="joined", viewonly=True)

    # Optional link to estimate project
    estimate_project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("estimate_project.id", name="fk_adjuster_case_estimate_project_id", ondelete="SET NULL"),
        nullable=True,
    )
    estimate_project: Mapped["EstimateProject | None"] = relationship(lazy="joined", viewonly=True)

    # PA assignment
    assigned_pa_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_adjuster_case_assigned_pa_id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_pa: Mapped["User | None"] = relationship(
        foreign_keys=[assigned_pa_id], lazy="joined", viewonly=True,
    )

    # Step 0: Intake
    intake_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    intake_loss_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    intake_loss_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    intake_address: Mapped[str | None] = mapped_column(String(256), nullable=True)
    intake_insured_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    intake_carrier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    intake_policy_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    intake_claim_number: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Step 3: Scope
    scope_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Step 2: Damage
    damage_ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Step 6: Final Report
    final_report_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Step 5: PA Review
    pa_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pa_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pa_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    documents = relationship(
        "AdjusterCaseDocument", back_populates="case", cascade="all, delete-orphan", lazy="selectin",
    )
    policy_analyses = relationship(
        "AdjusterCasePolicyAnalysis", back_populates="case", cascade="all, delete-orphan", lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<AdjusterCase(id={self.id}, case_number={self.case_number}, status={self.status})>"
