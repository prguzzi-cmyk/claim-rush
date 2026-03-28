#!/usr/bin/env python

"""SQLAlchemy model for the role table"""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.role_permission import associate_role_permission
from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Permission, User


class Role(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    name: Mapped[str] = mapped_column(String(50))
    display_name: Mapped[str] = mapped_column(String(50))

    # Relationships
    permissions: Mapped[list["Permission"]] = relationship(
        secondary=associate_role_permission,
        backref="roles",
        lazy="subquery",
        cascade="all, delete",
    )
    users: Mapped[list["User"]] = relationship(
        primaryjoin="Role.id == User.role_id",
        lazy="subquery",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, name: {self.name!r})"
