#!/usr/bin/env python

"""SQLAlchemy model for the claim comment table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Comment

if TYPE_CHECKING:
    from app.models import Claim


class ClaimComment(Comment):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "comment.id",
            name="fk_claim_comment_id",
        ),
        primary_key=True,
    )
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_comment_claim_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "claim_comment",
    }

    # Relationships
    claim: Mapped["Claim"] = relationship(
        back_populates="claim_comments",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, claim_id={self.claim_id!r}, "
            f"text: {self.text!r})"
        )
