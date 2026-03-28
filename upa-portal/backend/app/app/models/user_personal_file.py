#!/usr/bin/env python

"""SQLAlchemy model for the lead file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import File


class UserPersonalFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_user_personal_file_id",
        ),
        primary_key=True,
    )
    state: Mapped[str] = mapped_column(String(150))
    expiration_date: Mapped[str] = mapped_column(String(150))
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_personal_file_owner_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "user_personal_file",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, owner_id={self.owner_id!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
