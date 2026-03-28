#!/usr/bin/env python

"""SQLAlchemy model for intake control configuration"""

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class IntakeConfig(TimestampMixin, Base):
    """Admin control configuration for public intake links.

    Each row represents one intake configuration (public link + rep +
    hierarchy + routing rules + script settings).
    """

    # ── 1. Intake Identity ──
    intake_name: Mapped[str] = mapped_column(String(150), default="ACI Claim Intake")
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    campaign_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── 2. ACI Representative ──
    rep_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    rep_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rep_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rep_email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ai_secretary_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )

    # ── 3. Hierarchy Mapping ──
    assigned_cp_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_cfg_cp", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_rvp_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_cfg_rvp", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_cfg_agent", ondelete="SET NULL"),
        nullable=True,
    )
    territory_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("territory.id", name="fk_intake_cfg_territory", ondelete="SET NULL"),
        nullable=True,
    )

    # ── 4. Routing Rules ──
    default_assignee_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_intake_cfg_default_assignee", ondelete="SET NULL"),
        nullable=True,
    )
    fallback_home_office: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true",
    )
    rescue_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true",
    )
    territory_enforcement: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )

    # ── 5. AI / Script Settings ──
    voice_script_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sms_script_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    intake_opening_script: Mapped[str | None] = mapped_column(Text(), nullable=True)
    brochure_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── 6. Public Link Output ──  (read-only / computed, stored for caching)
    public_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tracked_outreach_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    qr_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Relationships ──
    assigned_cp = relationship("User", foreign_keys=[assigned_cp_id], lazy="joined", viewonly=True)
    assigned_rvp = relationship("User", foreign_keys=[assigned_rvp_id], lazy="joined", viewonly=True)
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id], lazy="joined", viewonly=True)
    default_assignee = relationship("User", foreign_keys=[default_assignee_id], lazy="joined", viewonly=True)
    territory = relationship("Territory", foreign_keys=[territory_id], lazy="joined", viewonly=True)

    def __repr__(self) -> str:
        return f"IntakeConfig(id={self.id!r}, slug={self.slug!r}, active={self.is_active!r})"
