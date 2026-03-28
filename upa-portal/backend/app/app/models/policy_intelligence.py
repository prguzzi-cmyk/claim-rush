#!/usr/bin/env python

"""Policy Intelligence Model — consolidated structured policy data (one row per document)."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.policy_document import PolicyDocument


class PolicyIntelligence(TimestampMixin, Base):
    """One-to-one consolidated intelligence record for a policy document."""

    policy_document_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "policy_document.id",
            name="fk_policy_intelligence_policy_document_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    # Copied metadata
    carrier: Mapped[str | None] = mapped_column(String(200), nullable=True)
    insured_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    policy_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Coverage limits (A–F)
    coverage_a_dwelling: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_b_other_structures: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_c_personal_property: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_d_loss_of_use: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_e_liability: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_f_medical: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    other_coverage_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Deductibles
    deductible_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deductible_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    deductible_wind_hail: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deductible_hurricane: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deductible_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Structured clause text
    endorsements_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    exclusions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    replacement_cost_language: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordinance_and_law: Mapped[str | None] = mapped_column(Text, nullable=True)
    matching_language: Mapped[str | None] = mapped_column(Text, nullable=True)
    loss_settlement_clause: Mapped[str | None] = mapped_column(Text, nullable=True)
    appraisal_clause: Mapped[str | None] = mapped_column(Text, nullable=True)
    duties_after_loss: Mapped[str | None] = mapped_column(Text, nullable=True)
    ale_loss_of_use_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_notice_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI summary + confidence
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationship
    policy_document: Mapped["PolicyDocument"] = relationship(
        back_populates="intelligence",
    )

    def __repr__(self) -> str:
        return f"<PolicyIntelligence(id={self.id}, doc_id={self.policy_document_id})>"
