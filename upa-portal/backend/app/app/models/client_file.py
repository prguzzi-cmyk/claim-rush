#!/usr/bin/env python

"""SQLAlchemy model for the client file table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import File

if TYPE_CHECKING:
    from app.models import Client


class ClientFile(File):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_client_file_id",
        ),
        primary_key=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_client_file_client_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "client_file",
    }

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="client_files")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, client_id={self.client_id!r}, "
            f"name: {self.name!r}, path: {self.path!r})"
        )
