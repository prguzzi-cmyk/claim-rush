#!/usr/bin/env python

"""SQLAlchemy model for the agent_profile table.

One-to-one satellite of `user` — exists only for users whose role determines
they're an agent/rep/partner/admin in the commission hierarchy. Holds the
agent-specific compliance, tax, and employment fields that don't belong on
the general `user` table (where they'd be null for non-agent users).

`agent_number` is a human-readable, role-prefixed, sequentially-numbered
identifier auto-generated on insert by the service layer using per-prefix
Postgres sequences:

    role  AGENT               → WA-####
    role  RVP                 → RVP-####
    role  CP                  → CP-####
    role  ADMIN / super-admin → ADM-####
    other                     → GEN-####

Prefixes are independent, zero-padded to 4 digits. Sequences live in the
migration (c0mm155ag02…) and are called via nextval() in the service at
insert time.
"""

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import File, User


class AgentProfile(TimestampMixin, AuditMixin, Base):
    # 1:1 with user — UNIQUE constraint enforced at the migration level.
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_agent_profile_user_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    # Role-prefixed, zero-padded, globally unique human ID (WA-0001, RVP-0001, …).
    # Populated by the service layer via Postgres sequences (see migration).
    agent_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)

    # ── Tax / identity ────────────────────────────────────────────────
    # Store only the last 4 of SSN/ITIN — full value belongs in an encrypted
    # identity vault, not this table.
    ssn_or_itin_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    # '1099' | 'W2' | 'S_CORP' | 'LLC'
    tax_classification: Mapped[str | None] = mapped_column(String(20), nullable=True)
    w9_signed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    w9_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("file.id", name="fk_agent_profile_w9_file_id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Employment ────────────────────────────────────────────────────
    employment_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    employment_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    termination_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Compliance ────────────────────────────────────────────────────
    # 'PENDING' | 'PASSED' | 'FAILED' | 'EXEMPT'
    background_check_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    background_check_completed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    drug_test_passed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    non_compete_signed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    non_compete_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("file.id", name="fk_agent_profile_non_compete_file_id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Emergency contact / beneficiary ───────────────────────────────
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    beneficiary_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    beneficiary_relationship: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Commission configuration ──────────────────────────────────────
    # Optional per-agent override of the default 60% writing-agent field share.
    # NULL means "use the default from commission_service". Values are
    # percent-of-field (0–100).
    commission_tier_override: Mapped[Decimal | None] = mapped_column(
        Numeric(4, 2), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ────────────────────────────────────────────────
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], viewonly=True, lazy="joined"
    )
    w9_file: Mapped["File | None"] = relationship(
        foreign_keys=[w9_file_id], viewonly=True, lazy="joined"
    )
    non_compete_file: Mapped["File | None"] = relationship(
        foreign_keys=[non_compete_file_id], viewonly=True, lazy="joined"
    )
