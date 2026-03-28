#!/usr/bin/env python

"""SQLAlchemy model for the lead file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import Lead


class LeadFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_lead_file_id",
        ),
        primary_key=True,
    )
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_lead_file_lead_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "lead_file",
    }

    # Relationships
    lead: Mapped["Lead"] = relationship(back_populates="lead_files")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, lead_id={self.lead_id!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
