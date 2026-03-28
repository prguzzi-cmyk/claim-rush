#!/usr/bin/env python

"""SQLAlchemy model for the claim file share"""

from sqlalchemy import UUID, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class ClaimFileShare(TimestampMixin, Base):
    email_files_to: Mapped[str] = mapped_column(String, nullable=False)
    share_type: Mapped[int] = mapped_column(Integer, nullable=False)
    expiration_date: Mapped[Date | None] = mapped_column(Date())
    message: Mapped[str | None] = mapped_column(String)

    # Relationship to ClaimFileShareDetails
    claim_file_share_details: Mapped[list["ClaimFileShareDetails"]] = relationship(
        "ClaimFileShareDetails",
        back_populates="claim_file_share",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, email_files_to={self.email_files_to!r}, "
            f"share_type={self.share_type!r}, expiration_date={self.expiration_date!r}, "
            f"message={self.message!r})"
        )


class ClaimFileShareDetails(Base):
    claim_file_id = Column(UUID(as_uuid=True), ForeignKey("file.id"), primary_key=True)
    share_id = Column(
        UUID(as_uuid=True), ForeignKey("claim_file_share.id"), primary_key=True
    )

    # Relationships
    file = relationship("File", backref="claim_file_share_details")
    claim_file_share = relationship(
        "ClaimFileShare", back_populates="claim_file_share_details"
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(claim_file_id={self.claim_file_id!r}, "
            f"share_id={self.share_id!r})"
        )
