#!/usr/bin/env python

"""Timestamp Mixin"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

if TYPE_CHECKING:
    from app.models import User


class AuditMixin:
    @declared_attr
    def created_by_id(cls) -> Mapped[UUID | None]:
        return mapped_column(ForeignKey("user.id"), default=None)

    @declared_attr
    @classmethod
    def created_by(cls) -> Mapped["User"]:
        return relationship(
            primaryjoin="%s.created_by_id == User.id" % cls.__name__,
            lazy="subquery",
        )

    @declared_attr
    def updated_by_id(cls) -> Mapped[UUID | None]:
        return mapped_column(ForeignKey("user.id"), default=None)

    @declared_attr
    @classmethod
    def updated_by(cls) -> Mapped["User"]:
        return relationship(
            primaryjoin="%s.created_by_id == User.id" % cls.__name__,
            lazy="subquery",
        )
