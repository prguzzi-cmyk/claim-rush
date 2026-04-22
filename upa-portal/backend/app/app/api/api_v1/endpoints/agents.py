#!/usr/bin/env python

"""Agent profile API routes — mounted under /v1/agents.

Gated by the shared `commission_auth` dep (DEV_BYPASS=1 skips bearer-token
check while devAutoLogin is on).
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps.app import get_db_session
from app.api.deps.dev_bypass import commission_auth
from app.schemas.agent import (
    AgentBankingDTO,
    AgentDocumentDTO,
    AgentLicenseCreateRequest,
    AgentLicenseDTO,
    AgentLicenseUpdateRequest,
    AgentProfileCreateRequest,
    AgentProfileDTO,
    AgentProfileUpdateRequest,
)
from app.services.agent_service import agent_service


router = APIRouter()


# ─── Profile CRUD ──────────────────────────────────────────────────────────


@router.get("/", response_model=list[AgentProfileDTO])
def list_agent_profiles(
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """List all agent profiles (ordered by agent_number)."""
    return agent_service.list_profiles(db_session)


@router.get("/by-number/{agent_number}", response_model=AgentProfileDTO)
def get_agent_by_number(
    agent_number: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Lookup by the human-readable agent_number (e.g., WA-0001)."""
    p = agent_service.get_profile_by_agent_number(db_session, agent_number)
    if not p:
        raise HTTPException(status_code=404, detail=f"No agent with number {agent_number}")
    return p


@router.get("/by-user/{user_id}", response_model=AgentProfileDTO)
def get_agent_by_user_id(
    user_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Lookup by the underlying user_id (useful when the frontend has the
    user but not the profile id)."""
    p = agent_service.get_profile_by_user_id(db_session, user_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"No agent profile for user {user_id}")
    return p


@router.get("/{profile_id}", response_model=AgentProfileDTO)
def get_agent_by_id(
    profile_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    p = agent_service.get_profile_by_id(db_session, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return p


@router.post("/", response_model=AgentProfileDTO, status_code=status.HTTP_201_CREATED)
def create_agent_profile(
    payload: AgentProfileCreateRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Create an agent_profile. agent_number is auto-generated from the
    user's role prefix (WA/RVP/CP/ADM/GEN) using a per-prefix sequence."""
    try:
        profile = agent_service.create_profile(
            db_session,
            **payload.dict(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return agent_service.get_profile_by_id(db_session, profile.id)


@router.patch("/{profile_id}", response_model=AgentProfileDTO)
def update_agent_profile(
    profile_id: UUID,
    payload: AgentProfileUpdateRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Partial update. agent_number and user_id are immutable."""
    updates = payload.dict(exclude_unset=True)
    profile = agent_service.update_profile(db_session, profile_id, **updates)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return agent_service.get_profile_by_id(db_session, profile.id)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_profile(
    profile_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Hard-delete an agent_profile. Underlying User and ledger rows are kept."""
    ok = agent_service.delete_profile(db_session, profile_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return None


# ─── Satellites (read-only in this step; writes ship with Step 3 UI) ───────


@router.get("/{profile_id}/licenses", response_model=list[AgentLicenseDTO])
def list_agent_licenses(
    profile_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """List licenses for an agent (lookup by profile_id, uses profile.user_id internally)."""
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return agent_service.list_licenses(db_session, profile["user_id"])


@router.post(
    "/{profile_id}/licenses",
    response_model=AgentLicenseDTO,
    status_code=status.HTTP_201_CREATED,
)
def create_agent_license(
    profile_id: UUID,
    payload: AgentLicenseCreateRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Add a license row for an agent. Unique per (user, state, type, number)."""
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    try:
        return agent_service.create_license(
            db_session,
            user_id=profile["user_id"],
            **payload.dict(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.patch("/{profile_id}/licenses/{license_id}", response_model=AgentLicenseDTO)
def update_agent_license(
    profile_id: UUID,
    license_id: UUID,
    payload: AgentLicenseUpdateRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Partial update to a license row."""
    # profile_id is used to validate the license belongs to this agent
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    updates = payload.dict(exclude_unset=True)
    lic = agent_service.update_license(db_session, license_id, **updates)
    if not lic:
        raise HTTPException(status_code=404, detail=f"License {license_id} not found")
    return lic


@router.delete(
    "/{profile_id}/licenses/{license_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_agent_license(
    profile_id: UUID,
    license_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Remove a license row."""
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    ok = agent_service.delete_license(db_session, license_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"License {license_id} not found")
    return None


@router.get("/{profile_id}/banking", response_model=AgentBankingDTO | None)
def get_agent_banking(
    profile_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """Get banking (display-safe) for an agent, or null if none on file.

    Write path deferred until encryption infrastructure for full account +
    routing numbers is wired. See agent_banking model docstring.
    """
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return agent_service.get_banking(db_session, profile["user_id"])


@router.get("/{profile_id}/documents", response_model=list[AgentDocumentDTO])
def list_agent_documents(
    profile_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    _auth=Depends(commission_auth),
):
    """List uploaded personal documents (W-9, license scans, etc.)."""
    profile = agent_service.get_profile_by_id(db_session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent profile {profile_id} not found")
    return agent_service.list_documents(db_session, profile["user_id"])
