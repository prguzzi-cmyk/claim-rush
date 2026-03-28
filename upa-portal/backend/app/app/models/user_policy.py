#!/usr/bin/env python

"""SQLAlchemy model for the user policy table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, EqMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import PolicyPermission, User


class UserPolicy(EqMixin, TimestampMixin, AuditMixin, Base):
    # Foreign Keys
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_policy_user_id",
        )
    )

    # Relationships
    user: Mapped["User"] = relationship(
        primaryjoin="UserPolicy.user_id == User.id",
        lazy="subquery",
        viewonly=True,
    )
    permissions: Mapped[list["PolicyPermission"] | None] = relationship(
        back_populates="policy_association",
        cascade="all, delete-orphan",
        lazy="subquery",
    )

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id!r}, user_id: {self.user_id!r})"
