#!/usr/bin/env python

"""Policy Clause Model — AI-extracted clause/coverage from a vault policy document."""

from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class PolicyClause(TimestampMixin, Base):
    """Single clause/coverage/endorsement/exclusion extracted from a policy PDF by AI."""

    policy_document_id: Mapped[UUID] = mapped_column(
        ForeignKey("policy_document.id", name="fk_policy_clause_policy_document_id", ondelete="CASCADE"),
        nullable=False,
    )
    clause_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    section_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    applies_to: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ai_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    policy_document = relationship("PolicyDocument", back_populates="clauses")

    def __repr__(self) -> str:
        return f"<PolicyClause(id={self.id}, clause_type={self.clause_type}, title={self.title})>"
