#!/usr/bin/env python

"""SQLAlchemy model for the carrier_comparison table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.carrier_estimate import CarrierEstimate
    from app.models.estimate_project import EstimateProject


class CarrierComparison(TimestampMixin, AuditMixin, Base):
    comparison_data: Mapped[str | None] = mapped_column(Text())  # JSON
    price_threshold: Mapped[float] = mapped_column(Float(), default=5.0)
    aci_total: Mapped[float | None] = mapped_column(Float())
    carrier_total: Mapped[float | None] = mapped_column(Float())
    supplement_total: Mapped[float | None] = mapped_column(Float())
    match_count: Mapped[int] = mapped_column(Integer(), default=0)
    aci_only_count: Mapped[int] = mapped_column(Integer(), default=0)
    carrier_only_count: Mapped[int] = mapped_column(Integer(), default=0)
    price_diff_count: Mapped[int] = mapped_column(Integer(), default=0)
    status: Mapped[str] = mapped_column(String(20), default="completed", server_default="completed")

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_carrier_comparison_project_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    carrier_estimate_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "carrier_estimate.id",
            name="fk_carrier_comparison_carrier_estimate_id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="comparisons",
        viewonly=True,
    )
    carrier_estimate: Mapped["CarrierEstimate"] = relationship(
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r}, "
            f"supplement_total={self.supplement_total!r})"
        )
