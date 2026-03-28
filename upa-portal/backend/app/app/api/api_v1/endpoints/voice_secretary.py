#!/usr/bin/env python

"""
Voice Secretary Configuration Endpoints
=========================================
Manage per-agent AI secretary assignment, voice settings,
and premium configuration.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.voice_secretary import (
    ResolvedVoiceProfile,
    VoiceSecretaryCreate,
    VoiceSecretaryRead,
    VoiceSecretaryUpdate,
)
from app.services.voice_secretary_service import VoiceSecretaryService

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Secretary CRUD ────────────────────────────────────────────────

@router.post("/secretary", response_model=VoiceSecretaryRead)
def create_or_update_secretary(
    data: VoiceSecretaryCreate,
    db: Session = Depends(get_db),
):
    """Assign or update an AI voice secretary for an agent."""
    svc = VoiceSecretaryService(db)
    return svc.create_secretary(data)


@router.get("/secretary/{agent_id}", response_model=VoiceSecretaryRead)
def get_agent_secretary(
    agent_id: UUID,
    db: Session = Depends(get_db),
):
    """Get the voice secretary configuration for a specific agent."""
    svc = VoiceSecretaryService(db)
    sec = svc.get_by_agent(agent_id)
    if not sec:
        raise HTTPException(status_code=404, detail="No voice secretary configured for this agent")
    return sec


@router.patch("/secretary/{secretary_id}", response_model=VoiceSecretaryRead)
def update_secretary(
    secretary_id: UUID,
    updates: VoiceSecretaryUpdate,
    db: Session = Depends(get_db),
):
    """Update voice secretary settings."""
    svc = VoiceSecretaryService(db)
    sec = svc.update_secretary(secretary_id, updates)
    if not sec:
        raise HTTPException(status_code=404, detail="Secretary not found")
    return sec


@router.delete("/secretary/{secretary_id}")
def delete_secretary(
    secretary_id: UUID,
    db: Session = Depends(get_db),
):
    """Remove a voice secretary configuration."""
    svc = VoiceSecretaryService(db)
    if not svc.delete_secretary(secretary_id):
        raise HTTPException(status_code=404, detail="Secretary not found")
    return {"deleted": True}


@router.get("/secretaries", response_model=list[VoiceSecretaryRead])
def list_secretaries(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all configured voice secretaries (admin view)."""
    svc = VoiceSecretaryService(db)
    return svc.list_secretaries(limit=limit)


# ── Voice Profile Resolution ─────────────────────────────────────

@router.get("/resolve-profile", response_model=ResolvedVoiceProfile)
def resolve_voice_profile(
    agent_id: Optional[UUID] = None,
    lead_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    """
    Resolve the full voice profile for a call.

    Priority:
    1. Agent's custom secretary if one exists
    2. Platform default voice profile

    Returns: provider, voice agent ID, gender, style, script, greeting.
    """
    svc = VoiceSecretaryService(db)
    return svc.resolve_voice_profile(agent_id=agent_id, lead_id=lead_id)
