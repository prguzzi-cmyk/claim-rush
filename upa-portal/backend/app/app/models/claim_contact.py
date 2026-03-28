#!/usr/bin/env python

"""SQLAlchemy model for the claim contact table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import Claim


class ClaimContact(Base):
    # Contact Loss Address
    address_loss: Mapped[str | None] = mapped_column(String(255))
    city_loss: Mapped[str | None] = mapped_column(String(50))
    state_loss: Mapped[str | None] = mapped_column(String(50))
    zip_code_loss: Mapped[str | None] = mapped_column(String(20))

    # Foreign Keys
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_contact_claim_id",
            ondelete="CASCADE",
        )
    )

    # Relationships
    claim: Mapped["Claim"] = relationship(
        back_populates="claim_contact",
        lazy="subquery",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"address_loss: {self.address_loss!r}, "
            f"state_loss: {self.state_loss!r}, "
            f"zip_code_loss: {self.zip_code_loss!r})"
        )
