#!/usr/bin/env python

"""SQLAlchemy model for the contact table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import Lead


class LeadContact(Base):
    full_name: Mapped[str] = mapped_column(String(100))
    full_name_alt: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(100))
    email_alt: Mapped[str | None] = mapped_column(String(100))
    phone_number: Mapped[str] = mapped_column(String(20))
    phone_number_alt: Mapped[str | None] = mapped_column(String(20))
    phone_is_valid: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Contact Address
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(50))
    state: Mapped[str | None] = mapped_column(String(50))
    zip_code: Mapped[str | None] = mapped_column(String(20))

    # Contact Loss Address
    address_loss: Mapped[str | None] = mapped_column(String(255))
    city_loss: Mapped[str | None] = mapped_column(String(50))
    state_loss: Mapped[str | None] = mapped_column(String(50))
    zip_code_loss: Mapped[str | None] = mapped_column(String(20))

    # Opt-out / Consent
    sms_opt_out: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    email_opt_out: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    voice_opt_out: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    opt_out_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign Keys
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "lead.id",
            name="fk_lead_contact_lead_id",
            ondelete="CASCADE",
        )
    )

    # Relationships
    lead: Mapped["Lead"] = relationship(
        back_populates="contact",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, full_name: {self.full_name!r}, "
            f"email: {self.email!r}, phone_number: {self.phone_number!r})"
        )
