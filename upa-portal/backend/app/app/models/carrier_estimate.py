#!/usr/bin/env python

"""SQLAlchemy models for carrier_estimate and carrier_line_item tables"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.commission_claim import CommissionClaim
    from app.models.estimate_project import EstimateProject
    from app.models.estimate_room import EstimateRoom


class CarrierEstimate(TimestampMixin, AuditMixin, Base):
    carrier_name: Mapped[str] = mapped_column(String(200))
    upload_type: Mapped[str] = mapped_column(String(20), default="pdf")  # pdf, spreadsheet, paste
    file_name: Mapped[str | None] = mapped_column(String(500))
    file_key: Mapped[str | None] = mapped_column(String(500))  # S3 key
    raw_text: Mapped[str | None] = mapped_column(Text())
    status: Mapped[str] = mapped_column(String(20), default="parsed", server_default="parsed")
    parser_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # xactimate, generic, paste
    parse_confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high, medium, low
    total_cost: Mapped[float | None] = mapped_column(Float())
    notes: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "estimate_project.id",
            name="fk_carrier_estimate_project_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    # Optional direct link to a commission_claim. The carrier estimate
    # belongs to a project, but the project may serve multiple claims
    # over time, so the carrier estimate carries its own claim pointer.
    # SET NULL on claim delete — losing the claim shouldn't drop the
    # parsed estimate data.
    commission_claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "commission_claim.id",
            name="fk_carrier_estimate_commission_claim_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Relationships
    project: Mapped["EstimateProject"] = relationship(
        back_populates="carrier_estimates",
        viewonly=True,
    )
    commission_claim: Mapped["CommissionClaim | None"] = relationship(
        foreign_keys=[commission_claim_id],
        viewonly=True,
        lazy="select",
    )
    line_items: Mapped[list["CarrierLineItem"]] = relationship(
        back_populates="carrier_estimate",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"project_id={self.project_id!r}, "
            f"carrier_name={self.carrier_name!r})"
        )


class CarrierLineItem(TimestampMixin, Base):
    description: Mapped[str | None] = mapped_column(String(500))
    quantity: Mapped[float] = mapped_column(Float(), default=1.0)
    unit: Mapped[str | None] = mapped_column(String(20))
    unit_cost: Mapped[float | None] = mapped_column(Float())
    total_cost: Mapped[float | None] = mapped_column(Float())
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    line_item_code: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Xactimate code
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high, medium, low
    room_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer(), default=0)

    # Foreign Keys
    carrier_estimate_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "carrier_estimate.id",
            name="fk_carrier_line_item_carrier_estimate_id",
            ondelete="CASCADE",
        ),
        index=True,
    )
    matched_room_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "estimate_room.id",
            name="fk_carrier_line_item_matched_room_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Relationships
    carrier_estimate: Mapped["CarrierEstimate"] = relationship(
        back_populates="line_items",
        viewonly=True,
    )
    matched_room: Mapped["EstimateRoom | None"] = relationship(
        lazy="joined",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"carrier_estimate_id={self.carrier_estimate_id!r}, "
            f"description={self.description!r})"
        )
