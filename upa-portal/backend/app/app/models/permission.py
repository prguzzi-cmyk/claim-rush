#!/usr/bin/env python

"""SQLAlchemy model for the permission table"""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, EqMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import PolicyPermission


class Permission(EqMixin, SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    name: Mapped[str] = mapped_column(String(100))
    module: Mapped[str] = mapped_column(String(50))
    operation: Mapped[str] = mapped_column(String(50))

    # Relationships
    policy_associations: Mapped[list["PolicyPermission"]] = relationship(
        back_populates="permission",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, name: {self.name!r})"
