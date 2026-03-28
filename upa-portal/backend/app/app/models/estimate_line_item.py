#!/usr/bin/env python

"""SQLAlchemy model for the estimate_line_item table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.estimate_room import EstimateRoom
    from app.models.pricing_item import PricingItem


class EstimateLineItem(TimestampMixin, Base):
    description: Mapped[str | None] = mapped_column(String(500))
    quantity: Mapped[float] = mapped_column(Float(), default=1.0)
    unit: Mapped[str | None] = mapped_column(String(20))
    unit_cost: Mapped[float | None] = mapped_column(Float())
    total_cost: Mapped[float | None] = mapped_column(Float())
    notes: Mapped[str | None] = mapped_column(Text())
    status: Mapped[str] = mapped_column(String(20), default="approved", server_default="approved")
    source: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    confidence: Mapped[float | None] = mapped_column(Float(), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Foreign Keys
    room_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_room.id",
            name="fk_estimate_line_item_room_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    pricing_item_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "pricing_item.id",
            name="fk_estimate_line_item_pricing_item_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    pricing_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pricing_version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "pricing_version.id",
            name="fk_estimate_line_item_pricing_version_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Relationships
    room: Mapped["EstimateRoom"] = relationship(
        back_populates="line_items",
        viewonly=True,
    )
    pricing_item: Mapped["PricingItem | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"room_id={self.room_id!r}, "
            f"description={self.description!r}, "
            f"total_cost={self.total_cost!r})"
        )
