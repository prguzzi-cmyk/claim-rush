#!/usr/bin/env python

"""SQLAlchemy model for the client comment table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Comment

if TYPE_CHECKING:
    from app.models import Client


class ClientComment(Comment):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "comment.id",
            name="fk_client_comment_id",
        ),
        primary_key=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_client_comment_client_id",
        )
    )

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "client_comment",
    }

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="client_comments")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, client_id={self.client_id!r}, "
            f"text: {self.text!r})"
        )
