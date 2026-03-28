#!/usr/bin/env python

"""
Voice Secretary Configuration Service
=======================================
Manages per-agent AI secretary settings and resolves the correct
voice profile before any call is placed.
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.voice_secretary import VoiceSecretary
from app.schemas.voice_secretary import (
    ResolvedVoiceProfile,
    VoiceSecretaryCreate,
    VoiceSecretaryRead,
    VoiceSecretaryUpdate,
)

logger = logging.getLogger(__name__)

# Platform default voice profile (used when agent has no custom secretary)
PLATFORM_DEFAULT = ResolvedVoiceProfile(
    agent_id=UUID("00000000-0000-0000-0000-000000000000"),
    secretary_name="AI Assistant",
    voice_provider="platform_default",
    voice_agent_id=None,
    voice_gender="default",
    voice_style="professional",
    voice_id=None,
    language="en-US",
    script_style="professional",
    branded_greeting=None,
    branded_closing=None,
    is_premium=False,
    subscription_tier="standard",
    can_transfer=True,
)


class VoiceSecretaryService:
    def __init__(self, db: Session):
        self.db = db

    # ══════════════════════════════════════════════════════════════
    # 1. CRUD
    # ══════════════════════════════════════════════════════════════

    def create_secretary(self, data: VoiceSecretaryCreate) -> VoiceSecretary:
        """Assign an AI secretary to an agent."""
        # Check if agent already has one
        existing = self._get_by_agent(data.agent_id)
        if existing:
            # Update instead of duplicate
            return self.update_secretary(existing.id, VoiceSecretaryUpdate(
                **data.model_dump(exclude={"agent_id"})
            ))

        secretary = VoiceSecretary(**data.model_dump())
        self.db.add(secretary)
        self.db.commit()
        self.db.refresh(secretary)
        logger.info(f"Voice secretary created for agent {data.agent_id}: {secretary.secretary_name}")
        return secretary

    def update_secretary(self, secretary_id: UUID, updates: VoiceSecretaryUpdate) -> Optional[VoiceSecretary]:
        """Update secretary configuration."""
        sec = self.db.get(VoiceSecretary, secretary_id)
        if not sec:
            return None

        for field, value in updates.model_dump(exclude_unset=True).items():
            setattr(sec, field, value)

        self.db.commit()
        self.db.refresh(sec)
        return sec

    def get_secretary(self, secretary_id: UUID) -> Optional[VoiceSecretary]:
        return self.db.get(VoiceSecretary, secretary_id)

    def get_by_agent(self, agent_id: UUID) -> Optional[VoiceSecretary]:
        return self._get_by_agent(agent_id)

    def delete_secretary(self, secretary_id: UUID) -> bool:
        sec = self.db.get(VoiceSecretary, secretary_id)
        if not sec:
            return False
        self.db.delete(sec)
        self.db.commit()
        return True

    def list_secretaries(self, limit: int = 100) -> list[VoiceSecretary]:
        stmt = select(VoiceSecretary).order_by(VoiceSecretary.created_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    # ══════════════════════════════════════════════════════════════
    # 2. Voice Profile Resolution
    # ══════════════════════════════════════════════════════════════

    def resolve_voice_profile(
        self,
        agent_id: Optional[UUID] = None,
        lead_id: Optional[UUID] = None,
    ) -> ResolvedVoiceProfile:
        """
        Resolve the correct voice settings before any call is placed.

        Priority:
        1. If agent_id provided → look up agent's secretary config
        2. If lead_id provided → determine owning agent, then look up their config
        3. Fallback → platform default voice profile

        Returns everything needed to initiate a call:
        provider, voice agent, gender, style, script, greeting.
        """

        resolved_agent_id = agent_id

        # If only lead_id, resolve the owning agent
        if not resolved_agent_id and lead_id:
            resolved_agent_id = self._resolve_agent_from_lead(lead_id)

        if not resolved_agent_id:
            logger.debug("No agent resolved — using platform default")
            return PLATFORM_DEFAULT

        # Look up agent's secretary
        secretary = self._get_by_agent(resolved_agent_id)
        if not secretary or not secretary.is_active:
            logger.debug(f"No active secretary for agent {resolved_agent_id} — using platform default")
            default = PLATFORM_DEFAULT.model_copy()
            default.agent_id = resolved_agent_id
            return default

        # Enforce premium gating
        voice_gender = secretary.voice_gender
        voice_id = secretary.voice_id
        if not secretary.is_premium_voice_enabled:
            voice_gender = "default"
            voice_id = None

        return ResolvedVoiceProfile(
            agent_id=resolved_agent_id,
            secretary_name=secretary.secretary_name,
            voice_provider=secretary.voice_provider,
            voice_agent_id=secretary.voice_agent_id,
            voice_gender=voice_gender,
            voice_style=secretary.voice_style,
            voice_id=voice_id,
            language=secretary.language,
            script_style=secretary.personality_preset,
            branded_greeting=secretary.branded_greeting,
            branded_closing=secretary.branded_closing,
            is_premium=secretary.is_premium_voice_enabled,
            subscription_tier=secretary.subscription_tier,
            can_transfer=secretary.can_transfer_to_agent,
        )

    # ══════════════════════════════════════════════════════════════
    # 3. Internal Helpers
    # ══════════════════════════════════════════════════════════════

    def _get_by_agent(self, agent_id: UUID) -> Optional[VoiceSecretary]:
        stmt = select(VoiceSecretary).where(VoiceSecretary.agent_id == agent_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def _resolve_agent_from_lead(self, lead_id: UUID) -> Optional[UUID]:
        """
        Determine which agent owns a lead.
        Checks client_portal_lead first, then main lead table.
        """
        from app.models.client_portal_lead import ClientPortalLead
        from app.models.lead import Lead

        # Check client portal lead
        cpl = self.db.get(ClientPortalLead, lead_id)
        if cpl and cpl.assigned_agent_id:
            return cpl.assigned_agent_id

        # Check main lead
        lead = self.db.get(Lead, lead_id)
        if lead and lead.assigned_to:
            return lead.assigned_to

        return None
