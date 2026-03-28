#!/usr/bin/env python

"""SQLAlchemy model for the user meta table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import User


class UserMeta(Base):
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(50))
    state: Mapped[str | None] = mapped_column(String(50))
    zip_code: Mapped[str | None] = mapped_column(String(20))
    phone_number: Mapped[str | None] = mapped_column(String(20))
    phone_number_extension: Mapped[str | None] = mapped_column(String(20))
    avatar: Mapped[str | None]

    # Foreign Keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_meta_user_id",
            ondelete="CASCADE",
        )
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="user_meta",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, address: {self.address!r}, "
            f"city: {self.city!r}, state: {self.state!r})"
        )
