#!/usr/bin/env python

"""SQLAlchemy model for the lead comment table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Comment

if TYPE_CHECKING:
    from app.models import Lead


class LeadComment(Comment):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "comment.id",
            name="fk_lead_comment_id",
        ),
        primary_key=True,
    )
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_lead_comment_lead_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "lead_comment",
    }

    # Relationships
    lead: Mapped["Lead"] = relationship(back_populates="lead_comments")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, lead_id={self.lead_id!r}, "
            f"text: {self.text!r})"
        )
