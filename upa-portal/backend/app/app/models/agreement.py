#!/usr/bin/env python

"""
E-Sign Agreement Engine Models
================================
Digital agreement signing with PDF upload, flexible signature methods,
audit trail capture, and Certified Electronic Signature readiness.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, SoftDeleteMixin


class Agreement(SoftDeleteMixin, TimestampMixin, Base):
    """Core agreement record — one per signing transaction."""

    # Parties
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("client_portal_lead.id", name="fk_agr_lead", ondelete="SET NULL"))
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_agr_agent", ondelete="SET NULL"))
    signer_name: Mapped[str] = mapped_column(String(200))
    signer_email: Mapped[str | None] = mapped_column(String(200))
    signer_phone: Mapped[str | None] = mapped_column(String(30))

    # Document
    title: Mapped[str] = mapped_column(String(300), default="Claim Representation Agreement")
    source: Mapped[str] = mapped_column(String(30), default="system")
    # system | uploaded
    original_pdf_url: Mapped[str | None] = mapped_column(String(500))
    signed_pdf_url: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[str] = mapped_column(String(20), default="1.0")

    # Signing mode
    signing_mode: Mapped[str] = mapped_column(String(30), default="standard")
    # standard | certified
    signature_method: Mapped[str | None] = mapped_column(String(30))
    # draw | type | font | i_agree

    # Status tracking
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # draft | sent | viewed | started | signed | expired | cancelled
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    viewed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    signed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Delivery
    insured_copy_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    agent_copy_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Reminders
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reminder_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    # Signing fields configuration (JSON)
    field_config: Mapped[dict | None] = mapped_column(JSON)
    # [{type: "signature"|"initials"|"date"|"checkbox", page: 1, x: 100, y: 200, required: true}]

    # Relationships
    audit_entries: Mapped[list["AgreementAuditEntry"]] = relationship(
        "AgreementAuditEntry", back_populates="agreement", lazy="dynamic")


class AgreementAuditEntry(TimestampMixin, Base):
    """Immutable audit trail for every agreement interaction."""

    agreement_id: Mapped[UUID] = mapped_column(
        ForeignKey("agreement.id", name="fk_aae_agreement", ondelete="CASCADE"))

    # Event
    action: Mapped[str] = mapped_column(String(50))
    # created | sent | viewed | field_completed | signed | delivered_insured | delivered_agent | reminder_sent | expired | cancelled
    details: Mapped[str | None] = mapped_column(Text())

    # Signer environment
    ip_address: Mapped[str | None] = mapped_column(String(45))
    device_type: Mapped[str | None] = mapped_column(String(50))
    browser: Mapped[str | None] = mapped_column(String(100))
    platform: Mapped[str | None] = mapped_column(String(50))

    # Field-level tracking
    field_id: Mapped[str | None] = mapped_column(String(50))
    field_type: Mapped[str | None] = mapped_column(String(30))
    signature_method: Mapped[str | None] = mapped_column(String(30))

    # Relationship
    agreement: Mapped["Agreement"] = relationship("Agreement", back_populates="audit_entries")
