#!/usr/bin/env python

"""
Voice Secretary Configuration Model
=====================================
Per-agent AI secretary assignment with premium voice configuration.
Supports multi-tenant voice with provider-agnostic settings.
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models import User


class VoiceSecretary(TimestampMixin, Base):
    """
    Per-agent AI voice secretary configuration.
    Each agent/user can have their own assigned AI secretary with
    custom voice, personality, and provider settings.
    """

    # Owning agent
    agent_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_vs_agent_id", ondelete="CASCADE"),
        unique=True,
    )

    # Secretary identity
    secretary_name: Mapped[str] = mapped_column(String(100), default="AI Assistant")
    greeting_name: Mapped[str | None] = mapped_column(String(100))
    # e.g., "Hi, this is Sarah calling on behalf of [Agent Name]"

    # Voice provider configuration (provider-agnostic)
    voice_provider: Mapped[str] = mapped_column(String(50), default="platform_default")
    # platform_default, vapi, retell, bland, twilio, elevenlabs
    voice_agent_id: Mapped[str | None] = mapped_column(String(200))
    # Provider-specific agent/assistant ID

    # Voice style settings
    voice_gender: Mapped[str] = mapped_column(String(20), default="default")
    # default, male, female
    voice_style: Mapped[str] = mapped_column(String(50), default="professional")
    # professional, friendly, authoritative, empathetic, casual
    voice_id: Mapped[str | None] = mapped_column(String(200))
    # Provider-specific voice ID (e.g., ElevenLabs voice_id)
    language: Mapped[str] = mapped_column(String(10), default="en-US")

    # Premium features
    is_premium_voice_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    subscription_tier: Mapped[str] = mapped_column(String(30), default="standard")
    # standard, professional, enterprise

    # Script customization
    default_script_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("voice_script.id", name="fk_vs_default_script", ondelete="SET NULL")
    )
    branded_greeting: Mapped[str | None] = mapped_column(Text())
    # Custom greeting override, e.g., "Thank you for calling [Company]. This is [Secretary]."
    branded_closing: Mapped[str | None] = mapped_column(Text())

    # Personality / behavior
    personality_preset: Mapped[str] = mapped_column(String(50), default="standard")
    # standard, warm, direct, consultative
    call_style: Mapped[str] = mapped_column(String(30), default="outbound")
    # outbound, inbound, both

    # Feature flags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    can_handle_inbound: Mapped[bool] = mapped_column(Boolean, default=False)
    can_transfer_to_agent: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    agent: Mapped["User"] = relationship("User", foreign_keys=[agent_id], lazy="joined")
