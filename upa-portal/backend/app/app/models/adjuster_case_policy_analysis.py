#!/usr/bin/env python

"""Adjuster Case Policy Analysis Model — AI-parsed policy coverages."""

from uuid import UUID

from sqlalchemy import Float, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class AdjusterCasePolicyAnalysis(TimestampMixin, Base):
    """Single coverage entry parsed from a policy document by AI."""

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("adjuster_case.id", name="fk_adjuster_case_policy_analysis_case_id", ondelete="CASCADE"),
        nullable=False,
    )
    coverage_type: Mapped[str] = mapped_column(String(128), nullable=False)
    limit_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    deductible: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    exclusions: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    raw_ai_response: Mapped[str | None] = mapped_column(Text, nullable=True)

    case = relationship("AdjusterCase", back_populates="policy_analyses")

    def __repr__(self) -> str:
        return f"<AdjusterCasePolicyAnalysis(id={self.id}, coverage_type={self.coverage_type})>"
