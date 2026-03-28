#!/usr/bin/env python

"""SQLAlchemy model for the client task table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import UserTask

if TYPE_CHECKING:
    from app.models import Client


class ClientTask(UserTask):
    # Foreign Keys
    id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user_task.id",
            name="fk_client_task_id",
        ),
        primary_key=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_client_task_client_id",
        )
    )
    task_type: Mapped[str | None] = mapped_column(String(30))

    # Table Configuration
    __table_args__ = ()
    __mapper_args__ = {
        "polymorphic_identity": "client_task",
    }

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="client_tasks")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, client_id={self.client_id!r}, "
            f"title: {self.title!r})"
        )
