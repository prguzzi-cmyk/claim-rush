#!/usr/bin/env python

"""SQLAlchemy model for the pricing_item table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.pricing_version import PricingVersion


class PricingItem(TimestampMixin, Base):
    code: Mapped[str] = mapped_column(String(50), index=True)
    category: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    unit: Mapped[str | None] = mapped_column(String(20))
    base_cost: Mapped[float | None] = mapped_column(Float())
    labor_cost: Mapped[float | None] = mapped_column(Float())
    material_cost: Mapped[float | None] = mapped_column(Float())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Foreign Keys
    version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "pricing_version.id",
            name="fk_pricing_item_version_id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    # Relationships
    version: Mapped["PricingVersion | None"] = relationship(
        back_populates="items",
        viewonly=True,
    )

    __table_args__ = (
        UniqueConstraint("code", "version_id", name="uq_pricing_item_code_version"),
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"code={self.code!r}, "
            f"description={self.description!r})"
        )
