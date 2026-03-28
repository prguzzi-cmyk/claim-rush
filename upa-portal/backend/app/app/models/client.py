#!/usr/bin/env python

"""SQLAlchemy model for the client table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Claim, ClientComment, ClientFile, ClientTask, Lead, User


class Client(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    ref_number: Mapped[int] = mapped_column(BigInteger)
    full_name: Mapped[str] = mapped_column(String(100))
    full_name_alt: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(100))
    email_alt: Mapped[str | None] = mapped_column(String(100))
    phone_number: Mapped[str | None] = mapped_column(String(20))
    phone_number_alt: Mapped[str | None] = mapped_column(String(20))
    organization: Mapped[str | None] = mapped_column(String(255))

    # Contact Address
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(50))
    state: Mapped[str | None] = mapped_column(String(50))
    zip_code: Mapped[str | None] = mapped_column(String(20))

    # Foreign Keys
    belongs_to: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_client_belongs_to",
            ondelete="CASCADE",
        )
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint(
            "ref_number",
            name="uq_client_ref_number",
        ),
    )

    # Relationships
    belonged_user: Mapped["User"] = relationship(
        primaryjoin="Client.belongs_to == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=1,
    )
    client_comments: Mapped[list["ClientComment"]] = relationship(
        back_populates="client",
        viewonly=True,
        join_depth=1,
    )
    client_files: Mapped[list["ClientFile"]] = relationship(
        back_populates="client",
        viewonly=True,
        join_depth=1,
    )
    client_tasks: Mapped[list["ClientTask"]] = relationship(
        back_populates="client",
        viewonly=True,
        join_depth=1,
    )
    client_leads: Mapped[list["Lead"]] = relationship(
        lazy="select",
        viewonly=True,
        join_depth=1,
    )
    client_claims: Mapped[list["Claim"]] = relationship(
        lazy="select",
        viewonly=True,
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"ref_number: {self.ref_number!r}, "
            f"email: {self.email!r}, "
            f"belongs_to: {self.belongs_to!r})"
        )
