#!/usr/bin/env python

"""SQLAlchemy model for the user table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import Lead, Role, UserMeta


class User(TimestampMixin, Base):
    first_name: Mapped[str | None] = mapped_column(index=True)
    last_name: Mapped[str | None] = mapped_column(index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str]
    is_active: Mapped[bool] = mapped_column(default=True)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("role.id"))

    role: Mapped["Role"] = relationship(back_populates="users", lazy="subquery")
    user_meta: Mapped["UserMeta"] = relationship(
        back_populates="user", lazy="subquery", cascade="all, delete"
    )
    leads: Mapped[list["Lead"]] = relationship(
        primaryjoin="User.id == Lead.assigned_to",
        lazy="subquery",
        cascade="all, delete",
    )

    def __repr__(self) -> str:
        return (
            f"User(id={self.id!r}, first_name: {self.first_name!r}, "
            f"last_name: {self.last_name!r}, email: {self.email!r})"
        )
