#!/usr/bin/env python

"""SQLAlchemy model for the policy permission table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models import Permission, UserPolicy


class PolicyPermission(Base):
    __tablename__ = "policy_permission"

    effect: Mapped[str] = mapped_column(String(30))

    # Foreign Keys
    policy_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user_policy.id",
            name="fk_policy_permission_policy_id",
        ),
        primary_key=True,
    )
    permission_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "permission.id",
            name="fk_policy_permission_permission_id",
        ),
        primary_key=True,
    )

    # Relationships
    policy_association: Mapped["UserPolicy"] = relationship(
        back_populates="permissions",
        lazy="selectin",
    )
    permission: Mapped["Permission"] = relationship(
        back_populates="policy_associations",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(policy_id={self.policy_id!r}, "
            f"permission_id: {self.permission_id!r}, "
            f"effect={self.effect!r})"
        )
