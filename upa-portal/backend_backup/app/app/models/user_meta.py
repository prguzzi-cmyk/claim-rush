#!/usr/bin/env python

"""SQLAlchemy model for the user meta table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import User


class UserMeta(Base):
    address: Mapped[str | None]
    city: Mapped[str | None]
    state: Mapped[str | None]
    zip_code: Mapped[str | None]
    phone_number: Mapped[str | None]
    avatar: Mapped[str | None]
    user_id: Mapped[UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="user_meta", lazy="subquery")

    def __repr__(self) -> str:
        return (
            f"UserMeta(id={self.id!r}, address: {self.address!r}, "
            f"city: {self.city!r}, state: {self.state!r})"
        )
