#!/usr/bin/env python

"""SQLAlchemy model for the claim activity table"""

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import UserActivity


class ClaimActivity(UserActivity):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user_activity.id",
            name="fk_claim_activity_id",
        ),
        primary_key=True,
    )
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_activity_claim_id",
        )
    )
    title: Mapped[str | None] = mapped_column(String(100))

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "claim",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, claim_id={self.claim_id!r}, "
            f"timestamp: {self.timestamp!r}, activity_type: {self.activity_type!r})"
        )
