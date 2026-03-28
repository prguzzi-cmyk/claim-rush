#!/usr/bin/env python

"""SQLAlchemy model for the lead table"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import LeadComment, LeadContact, LeadFile, LeadOutcome, LeadRescueLog, LeadSkipTrace, LeadTask, User


class Lead(SoftDeleteMixin, TimestampMixin, AuditMixin, Base):
    ref_number: Mapped[int] = mapped_column(BigInteger)
    loss_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    peril: Mapped[str | None] = mapped_column(String(100))
    insurance_company: Mapped[str | None] = mapped_column(String(100))
    policy_number: Mapped[str | None] = mapped_column(String(50))
    claim_number: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30))
    source_info: Mapped[str | None] = mapped_column(String(100))
    instructions_or_notes: Mapped[str | None] = mapped_column(Text())
    last_outcome_status: Mapped[str | None] = mapped_column(String(50))
    score_tier: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )  # high | strong | medium | low
    is_rescued: Mapped[bool | None] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    info_sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # UPA → ACI Funnel
    routing_bucket: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    contact_status: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    template_profile: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_outreach_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reply: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_queue: Mapped[str | None] = mapped_column(String(50), nullable=True)
    escalated_to_aci: Mapped[bool | None] = mapped_column(Boolean, default=False, server_default="false")

    # Foreign Keys
    source: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_lead_source",
        )
    )
    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_lead_assigned_to",
            ondelete="CASCADE",
        )
    )
    lead_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "user.id",
            name="fk_lead_user_id",
        )
    )
    client_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "client.id",
            name="fk_lead_client_id",
            ondelete="CASCADE",
        )
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint(
            "ref_number",
            name="uq_lead_ref_number",
        ),
    )

    # Relationships
    source_user: Mapped["User"] = relationship(
        primaryjoin="Lead.source == User.id",
        lazy="joined",
        viewonly=True,
        join_depth=2,
    )
    assigned_user: Mapped["User"] = relationship(
        primaryjoin="Lead.assigned_to == User.id",
        lazy="subquery",
        viewonly=True,
    )
    contact: Mapped["LeadContact"] = relationship(
        back_populates="lead",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    lead_comments: Mapped[list["LeadComment"]] = relationship(
        back_populates="lead",
        viewonly=True,
    )
    lead_files: Mapped[list["LeadFile"]] = relationship(
        back_populates="lead",
        viewonly=True,
    )
    lead_tasks: Mapped[list["LeadTask"]] = relationship(
        back_populates="lead",
        viewonly=True,
    )
    lead_outcomes: Mapped[list["LeadOutcome"]] = relationship(
        primaryjoin="Lead.id == LeadOutcome.lead_id",
        viewonly=True,
    )
    skip_trace: Mapped["LeadSkipTrace | None"] = relationship(
        back_populates="lead",
        lazy="joined",
        uselist=False,
        cascade="all, delete-orphan",
    )
    rescue_logs: Mapped[list["LeadRescueLog"]] = relationship(
        primaryjoin="Lead.id == LeadRescueLog.lead_id",
        viewonly=True,
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, "
            f"ref_number: {self.ref_number!r}, "
            f"status: {self.status!r}, "
            f"assigned_to: {self.assigned_to!r})"
        )
