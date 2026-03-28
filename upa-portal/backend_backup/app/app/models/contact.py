#!/usr/bin/env python

"""SQLAlchemy model for the contact table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import Lead


class Contact(Base):
    full_name: Mapped[str] = mapped_column(index=True)
    full_name_alt: Mapped[str | None]
    email: Mapped[str] = mapped_column(index=True)
    email_alt: Mapped[str | None]
    phone_number: Mapped[str]
    phone_number_alt: Mapped[str | None]

    # Contact Address
    address: Mapped[str]
    city: Mapped[str]
    state: Mapped[str]
    zip_code: Mapped[str]

    # Contact Loss Address
    address_loss: Mapped[str | None]
    city_loss: Mapped[str | None]
    state_loss: Mapped[str | None]
    zip_code_loss: Mapped[str | None]

    # Foreign Keys
    lead_id: Mapped[UUID] = mapped_column(ForeignKey("lead.id", ondelete="CASCADE"))

    # Relationships
    lead: Mapped["Lead"] = relationship(back_populates="contact", lazy="subquery")
