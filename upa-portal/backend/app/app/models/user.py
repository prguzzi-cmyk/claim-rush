#!/usr/bin/env python

"""SQLAlchemy model for the user table"""

from typing import TYPE_CHECKING

from sqlalchemy import UUID, Boolean, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Role, UserMeta

class User(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    first_name: Mapped[str | None] = mapped_column(String(50))
    last_name: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(default=True)
    operating_mode: Mapped[str] = mapped_column(
        String(20), server_default="neutral", default="neutral"
    )
    national_access: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    is_accepting_leads: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    daily_lead_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # Foreign Keys
    role_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "role.id",
            name="fk_user_role_id",
            use_alter=True,
        )
    )
    parent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_parent_id",
        )
    )
    manager_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_user_manager_id",
        )
    )

    # Table Configuration
    __table_args__ = (
        Index(
            "ix_user_email",
            func.lower(email),
            unique=True,
        ),
    )

    # Relationships
    @declared_attr
    @classmethod
    def created_by(cls) -> Mapped["User"]:
        return relationship(
            "User",
            primaryjoin="User.created_by_id == User.id",
            foreign_keys=[cls.created_by_id],
            remote_side=[cls.id],
            lazy="select",
            join_depth=1,
            viewonly=True,
        )

    @declared_attr
    @classmethod
    def updated_by(cls) -> Mapped["User"]:
        return relationship(
            "User",
            primaryjoin="User.updated_by_id == User.id",
            foreign_keys=[cls.updated_by_id],
            remote_side=[cls.id],
            lazy="select",
            join_depth=1,
            viewonly=True,
        )

    @declared_attr
    @classmethod
    def parent(cls) -> Mapped["User"]:
        return relationship(
            "User",
            primaryjoin="User.parent_id == User.id",
            foreign_keys=[cls.parent_id],
            remote_side=[cls.id],
            lazy="select",
            join_depth=1,
            viewonly=True,
        )

    @declared_attr
    @classmethod
    def manager(cls) -> Mapped["User"]:
        return relationship(
            "User",
            primaryjoin="User.manager_id == User.id",
            foreign_keys=[cls.manager_id],
            remote_side=[cls.id],
            lazy="select",
            join_depth=1,
            viewonly=True,
        )

    user_meta: Mapped["UserMeta"] = relationship(
        back_populates="user",
        lazy="joined",
        cascade="all, delete-orphan",
        join_depth=2,
    )
    role: Mapped["Role"] = relationship(
        primaryjoin="User.role_id == Role.id",
        lazy="subquery",
        join_depth=1,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"first_name: {self.first_name!r}, "
            f"last_name: {self.last_name!r}, "
            f"email: {self.email!r})"
        )
