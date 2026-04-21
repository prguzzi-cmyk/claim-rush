#!/usr/bin/env python

"""SQLAlchemy model for the commission_claim table.

Distinct from the existing `claim` / `claim_payment` tables — those track the
carrier-side view of a claim (carrier payments, coverage, etc). This table
tracks the commission-engine view: writing agent / RVP / CP assignment, gross
fee, stage in the commission lifecycle. Commission math runs from here.
"""

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import User


class CommissionClaim(TimestampMixin, AuditMixin, Base):
    client_name: Mapped[str] = mapped_column(String(200))
    claim_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    # Free-form stage string; matches the 12 values in Angular ClaimStage enum
    # (INTAKE_SIGNED, INSPECTION_SCHEDULED, …, SETTLEMENT_REACHED, PAID).
    stage: Mapped[str] = mapped_column(String(40), server_default="INTAKE_SIGNED")
    gross_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")
    # True when there's no RVP in the chain (writing agent absorbs RVP override).
    direct_cp: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)

    # Foreign Keys — who's on this claim
    writing_agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_commission_claim_writing_agent_id"),
        index=True,
    )
    rvp_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_commission_claim_rvp_id"),
        nullable=True,
    )
    cp_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_commission_claim_cp_id"),
        nullable=True,
    )

    # Relationships (viewonly to avoid insert/update side-effects through these edges)
    writing_agent: Mapped["User"] = relationship(
        foreign_keys=[writing_agent_id],
        viewonly=True,
        lazy="joined",
    )
    rvp: Mapped["User | None"] = relationship(
        foreign_keys=[rvp_id],
        viewonly=True,
        lazy="joined",
    )
    cp: Mapped["User | None"] = relationship(
        foreign_keys=[cp_id],
        viewonly=True,
        lazy="joined",
    )
