#!/usr/bin/env python

"""SQLAlchemy model for the defense_note table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_project import EstimateProject


class DefenseNote(TimestampMixin, AuditMixin, Base):
    """Structured supplement-defense notes tied to an estimate project.

    One record per project (upserted on save). Each field stores the
    adjuster's narrative for one section of the defense package.
    """

    pricing_defense: Mapped[str | None] = mapped_column(Text(), nullable=True)
    omitted_scope_defense: Mapped[str | None] = mapped_column(Text(), nullable=True)
    matching_continuity_defense: Mapped[str | None] = mapped_column(
        Text(), nullable=True
    )
    quantity_scope_defense: Mapped[str | None] = mapped_column(Text(), nullable=True)
    code_standard_support: Mapped[str | None] = mapped_column(Text(), nullable=True)
    recommended_action_notes: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_defense_note_project_id",
            ondelete="CASCADE",
        ),
        unique=True,
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="defense_notes",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r})"
        )
