#!/usr/bin/env python

"""SQLAlchemy model for the pricing_version table"""

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.pricing_item import PricingItem
    from app.models.user import User


class PricingVersion(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    source: Mapped[str] = mapped_column(String(50))  # "craftsman", "xactimate", "manual", "legacy"
    version_label: Mapped[str] = mapped_column(String(50))  # "2026-Q1", "2026-Q2"
    effective_date: Mapped[date] = mapped_column(Date())
    region: Mapped[str] = mapped_column(String(100), default="national")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, active, archived
    item_count: Mapped[int] = mapped_column(Integer(), default=0)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    imported_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_pricing_version_imported_by", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    items: Mapped[list["PricingItem"]] = relationship(back_populates="version")
    imported_by_user: Mapped["User | None"] = relationship(
        primaryjoin="PricingVersion.imported_by == User.id",
        foreign_keys="PricingVersion.imported_by",
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"source={self.source!r}, "
            f"version_label={self.version_label!r}, "
            f"status={self.status!r})"
        )
