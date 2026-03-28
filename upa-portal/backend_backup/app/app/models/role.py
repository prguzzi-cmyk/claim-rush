#!/usr/bin/env python

"""SQLAlchemy model for the role table"""

from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.role_permission import associate_role_permission
from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import Permission, User


class Role(TimestampMixin, Base):
    name: Mapped[str] = mapped_column(index=True)
    display_name: Mapped[str]

    permissions: Mapped[list["Permission"]] = relationship(
        secondary=associate_role_permission,
        back_populates="roles",
        lazy="subquery",
        cascade="all, delete",
    )
    users: Mapped[list["User"]] = relationship(back_populates="role", lazy="subquery")

    def __repr__(self) -> str:
        return f"Role(name: {self.name!r}, can_be_removed: {self.can_be_removed!r}"
