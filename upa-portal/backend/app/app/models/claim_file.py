#!/usr/bin/env python

"""SQLAlchemy model for the claim file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import Claim


class ClaimFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_claim_file_id",
        ),
        primary_key=True,
    )
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_file_claim_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "claim_file",
    }

    # Relationships
    claim: Mapped["Claim"] = relationship(
        back_populates="claim_files",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, claim_id={self.claim_id!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
