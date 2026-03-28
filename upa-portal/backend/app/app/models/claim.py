#!/usr/bin/env python

"""SQLAlchemy model for the claim table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.associations.claim_collaborator import associate_claim_collaborator
from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import (
        ClaimBusinessEmail,
        ClaimComment,
        ClaimCommunication,
        ClaimContact,
        ClaimFile,
        ClaimPayment,
        ClaimTask,
        Client,
        User,
        ClaimCoverage,
    )


class Claim(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    ref_number: Mapped[int] = mapped_column(BigInteger)
    loss_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    peril: Mapped[str | None] = mapped_column(String(100))
    insurance_company: Mapped[str | None] = mapped_column(String(100))
    policy_number: Mapped[str | None] = mapped_column(String(50))
    policy_type: Mapped[str | None] = mapped_column(String(100))
    sub_policy_type: Mapped[str | None] = mapped_column(String(255))
    date_logged: Mapped[Date | None] = mapped_column(Date())
    lawsuit_deadline: Mapped[Date | None] = mapped_column(Date())
    mortgage_company: Mapped[str | None] = mapped_column(String(100))
    fema_claim: Mapped[bool | None] = mapped_column(default=False)
    state_of_emergency: Mapped[bool | None] = mapped_column(default=False)
    inhabitable: Mapped[bool | None] = mapped_column(default=False)
    contract_sign_date: Mapped[Date | None] = mapped_column(Date())
    anticipated_amount: Mapped[float | None] = mapped_column(Float())
    fee_type: Mapped[str | None] = mapped_column(String(20))
    fee: Mapped[float | None] = mapped_column(Float())
    claim_number: Mapped[str | None] = mapped_column(String(50))
    source_info: Mapped[str | None] = mapped_column(String(100))
    current_phase: Mapped[str] = mapped_column(String(50))
    escalation_path: Mapped[str | None] = mapped_column(String(30), default="none")
    sub_status: Mapped[str | None] = mapped_column(String(50), default="none")
    origin_type: Mapped[str | None] = mapped_column(String(50), default="new-claim")
    date_aci_entered: Mapped[Date | None] = mapped_column(Date())
    prior_carrier_payments: Mapped[float | None] = mapped_column(Float())
    recovery_mode: Mapped[str | None] = mapped_column(String(30), default="none")
    instructions_or_notes: Mapped[str | None] = mapped_column(Text())

    # Foreign Keys
    source: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_claim_source",
            ondelete="CASCADE",
        )
    )
    signed_by: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_claim_signed_by",
            ondelete="CASCADE",
        )
    )
    adjusted_by: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_claim_adjusted_by",
            ondelete="CASCADE",
        )
    )
    assigned_to: Mapped[UUID] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_claim_assigned_to",
            ondelete="CASCADE",
        )
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_claim_client_id",
            ondelete="CASCADE",
        )
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint(
            "ref_number",
            name="uq_claim_ref_number",
        ),
    )

    # Relationships
    source_user: Mapped["User"] = relationship(
        primaryjoin="Claim.source == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=2,
    )
    signed_by_user: Mapped["User"] = relationship(
        primaryjoin="Claim.signed_by == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=2,
    )
    adjusted_by_user: Mapped["User"] = relationship(
        primaryjoin="Claim.adjusted_by == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=2,
    )
    assigned_user: Mapped["User"] = relationship(
        primaryjoin="Claim.assigned_to == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=2,
    )
    claim_contact: Mapped["ClaimContact"] = relationship(
        back_populates="claim",
        lazy="joined",
        cascade="all, delete-orphan",
        join_depth=1,
    )
    coverages: Mapped[list["ClaimCoverage"]] = relationship(
        lazy="joined",
    )
    client: Mapped["Client"] = relationship(
        lazy="joined",
        viewonly=True,
        join_depth=1,
    )
    claim_comments: Mapped[list["ClaimComment"]] = relationship(
        back_populates="claim",
        viewonly=True,
        join_depth=1,
    )
    claim_files: Mapped[list["ClaimFile"]] = relationship(
        back_populates="claim",
        viewonly=True,
        join_depth=1,
    )
    claim_tasks: Mapped[list["ClaimTask"]] = relationship(
        back_populates="claim",
        viewonly=True,
        join_depth=1,
    )
    claim_payments: Mapped[list["ClaimPayment"]] = relationship(
        back_populates="claim",
        viewonly=True,
        join_depth=1,
    )
    claim_business_email: Mapped["ClaimBusinessEmail"] = relationship(
        back_populates="claim",
        lazy="subquery",
        viewonly=True,
        join_depth=1,
    )
    claim_communications: Mapped[list["ClaimCommunication"]] = relationship(
        back_populates="claim",
        viewonly=True,
        join_depth=1,
    )
    collaborators: Mapped[list["User"]] = relationship(
        secondary=associate_claim_collaborator,
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"ref_number: {self.ref_number!r}, "
            f"current_phase: {self.current_phase!r}, "
            f"assigned_to: {self.assigned_to!r})"
        )
