#!/usr/bin/env python

"""SQLAlchemy model for the permission table"""

from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.role_permission import associate_role_permission
from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.role import Role


class Permission(TimestampMixin, Base):
    name: Mapped[str] = mapped_column(index=True)
    module: Mapped[str]
    operation: Mapped[str]

    roles: Mapped[list["Role"]] = relationship(
        secondary=associate_role_permission,
        back_populates="permissions",
        lazy="subquery",
        cascade="all, delete",
    )

    def __repr__(self) -> str:
        return f"Permission(name: {self.name!r})"
