#!/usr/bin/env python

"""SQLAlchemy model for the template file table"""

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import File


class TemplateFile(File):
    state: Mapped[str] = mapped_column(String(5))

    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_template_file_id",
        ),
        primary_key=True,
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "template_file",
    }

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, state: {self.state!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
