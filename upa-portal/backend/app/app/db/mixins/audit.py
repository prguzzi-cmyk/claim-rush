#!/usr/bin/env python

"""Audit Mixin"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.core.log import logger
from app.utils.common import camel_to_snake_case

if TYPE_CHECKING:
    from app.models import User


class AuditMixin:
    @declared_attr
    @classmethod
    def created_by_id(cls) -> Mapped[UUID | None]:
        return mapped_column(
            ForeignKey(
                "user.id",
                name="fk_%s_created_by_id" % camel_to_snake_case(cls.__name__),
            ),
            default=cls.get_user_id,
        )

    @declared_attr
    @classmethod
    def created_by(cls) -> Mapped["User"]:
        return relationship(
            primaryjoin="%s.created_by_id == User.id" % cls.__name__,
            lazy="joined",
            join_depth=1,
            viewonly=True,
        )

    @declared_attr
    @classmethod
    def updated_by_id(cls) -> Mapped[UUID | None]:
        return mapped_column(
            ForeignKey(
                "user.id",
                name="fk_%s_updated_by_id" % camel_to_snake_case(cls.__name__),
            ),
            default=None,
            onupdate=cls.get_user_id,
        )

    @declared_attr
    @classmethod
    def updated_by(cls) -> Mapped["User"]:
        return relationship(
            primaryjoin="%s.updated_by_id == User.id" % cls.__name__,
            foreign_keys=f"{cls.__name__}.updated_by_id",
            lazy="joined",
            join_depth=1,
            viewonly=True,
        )

    @classmethod
    def get_user_id(cls):
        from app.utils.contexts import UserContext

        try:
            user = UserContext.get()
            return user["id"]
        except Exception as e:
            logger.error(e)
            return None
