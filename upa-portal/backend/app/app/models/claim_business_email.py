#!/usr/bin/env python

"""SQLAlchemy model for the claim business email table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BusinessEmail

if TYPE_CHECKING:
    from app.models import Claim


class ClaimBusinessEmail(BusinessEmail):
    __tablename__ = None
    claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_claim_business_email_claim_id",
        ),
        nullable=True,
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "claim_business_email",
    }

    # Relationships
    claim: Mapped["Claim"] = relationship(
        back_populates="claim_business_email",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"claim_id={self.claim_id!r}, "
            f"first_name: {self.first_name!r}, "
            f"last_name: {self.last_name!r}, "
            f"email: {self.email!r})"
        )
