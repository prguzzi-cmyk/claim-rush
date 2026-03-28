#!/usr/bin/env python

"""SQLAlchemy model for the claim coverage table"""

from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    String, Float,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class ClaimCoverage(Base):
    coverage_type: Mapped[str] = mapped_column(String(255))
    policy_limit: Mapped[float | None] = mapped_column(Float())

    # Foreign Keys
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_coverage_claim_id",
            ondelete="CASCADE",
        )
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"claim_id: {self.claim_id!r}, "
            f"coverage_type: {self.coverage_type!r}, "
            f"policy_limit: {self.policy_limit!r})"
        )
