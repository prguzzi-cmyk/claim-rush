#!/usr/bin/env python

"""SQLAlchemy model for the estimate_project table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import Claim
    from app.models.carrier_comparison import CarrierComparison
    from app.models.carrier_estimate import CarrierEstimate
    from app.models.carrier_payment import CarrierPayment
    from app.models.defense_note import DefenseNote
    from app.models.estimate_photo import EstimatePhoto
    from app.models.estimate_room import EstimateRoom
    from app.models.fire_claim import FireClaim


class EstimateProject(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50), default="draft")
    estimate_mode: Mapped[str] = mapped_column(
        String(50), default="residential", server_default="residential"
    )
    total_cost: Mapped[float | None] = mapped_column(Float())
    notes: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    claim_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "claim.id",
            name="fk_estimate_project_claim_id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )
    pricing_version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "pricing_version.id",
            name="fk_estimate_project_pricing_version_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    pricing_region: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    claim: Mapped["Claim"] = relationship(
        lazy="joined",
        viewonly=True,
        join_depth=1,
    )
    rooms: Mapped[list["EstimateRoom"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    photos: Mapped[list["EstimatePhoto"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    fire_claim: Mapped["FireClaim | None"] = relationship(
        uselist=False,
        viewonly=True,
    )
    carrier_estimates: Mapped[list["CarrierEstimate"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    comparisons: Mapped[list["CarrierComparison"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    carrier_payments: Mapped[list["CarrierPayment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    defense_notes: Mapped["DefenseNote | None"] = relationship(
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"claim_id={self.claim_id!r}, "
            f"name={self.name!r}, "
            f"status={self.status!r})"
        )
