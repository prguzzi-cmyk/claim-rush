#!/usr/bin/env python

"""Fire Claim Media Model"""

from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class FireClaimMedia(TimestampMixin, Base):
    """Model for photos/videos attached to a fire claim."""

    fire_claim_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "fire_claim.id",
            name="fk_fire_claim_media_fire_claim_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    fire_claim = relationship("FireClaim", back_populates="media")

    def __repr__(self) -> str:
        return f"<FireClaimMedia(id={self.id}, media_type={self.media_type})>"
