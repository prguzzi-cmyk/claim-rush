#!/usr/bin/env python

"""SQLAlchemy model for the agent_license table.

1:N with `user`. One row per (state, license_type, license_number) triple
per agent — so an agent with public-adjuster licenses in TX, FL, and NY
has three rows.

This is the STRUCTURED source of truth for license metadata (number,
issued / expires dates, verification, renewal tracking). The signed PDF
continues to live in `user_personal_file` + `file`, optionally linked
via `file_id` below.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import File, User


class AgentLicense(TimestampMixin, AuditMixin, Base):
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_agent_license_user_id", ondelete="CASCADE"),
        index=True,
    )

    # 2-char US state code (CA, TX, FL, NY, …) — can extend later for non-US.
    state: Mapped[str] = mapped_column(String(2))

    # 'PUBLIC_ADJUSTER' | 'INSURANCE' | 'LEGAL' | 'REAL_ESTATE' | 'OTHER'
    license_type: Mapped[str] = mapped_column(String(40))

    license_number: Mapped[str] = mapped_column(String(80))

    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    # Verification audit: who confirmed the license with the issuing body, and when.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_agent_license_verified_by_id", ondelete="SET NULL"),
        nullable=True,
    )

    # 'ACTIVE' | 'LAPSED' | 'REVOKED' | 'SUSPENDED' | 'PENDING_RENEWAL'
    status: Mapped[str] = mapped_column(
        String(20), server_default="ACTIVE", default="ACTIVE"
    )

    # Optional link to the uploaded license PDF (stored in `file` via user_personal_file).
    file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("file.id", name="fk_agent_license_file_id", ondelete="SET NULL"),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        # Can't hold two identical-number licenses of the same type in the same state.
        UniqueConstraint(
            "user_id", "state", "license_type", "license_number",
            name="uq_agent_license_user_state_type_number",
        ),
        {"mysql_engine": "InnoDB"},
    )

    # Relationships
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], viewonly=True, lazy="joined"
    )
    verified_by: Mapped["User | None"] = relationship(
        foreign_keys=[verified_by_id], viewonly=True, lazy="joined"
    )
    file: Mapped["File | None"] = relationship(
        foreign_keys=[file_id], viewonly=True, lazy="joined"
    )
