#!/usr/bin/env python

"""
AI Sales Agent Session Endpoints
==================================
Persists and retrieves intake/consultation sessions for CRM tracking.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.sales_agent_session import SalesAgentSession

logger = logging.getLogger(__name__)

router = APIRouter()


class SessionCreate(BaseModel):
    id: str
    leadId: str
    leadData: dict
    currentStep: str
    status: str
    outcome: Optional[str] = None
    exchanges: list = []
    qualificationResult: Optional[dict] = None
    startedAt: str
    completedAt: Optional[str] = None
    dropOffStep: Optional[str] = None

    class Config:
        extra = "allow"


class SessionRead(BaseModel):
    id: UUID
    lead_id: str
    client_name: str
    current_step: str
    status: str
    outcome: Optional[str]
    exchanges: Optional[dict]
    started_at: Optional[str]
    completed_at: Optional[str]
    drop_off_step: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


@router.post("/sales-sessions")
def save_session(
    data: SessionCreate,
    db: Session = Depends(get_db),
):
    """Save or update a sales agent session."""
    # Check if session already exists (upsert by frontend session id)
    existing = db.execute(
        select(SalesAgentSession).where(SalesAgentSession.lead_id == data.leadId)
        .order_by(SalesAgentSession.created_at.desc())
    ).scalar_one_or_none()

    lead_data = data.leadData or {}

    if existing:
        existing.current_step = data.currentStep
        existing.status = data.status
        existing.outcome = data.outcome
        existing.exchanges = data.exchanges
        existing.completed_at = data.completedAt
        existing.drop_off_step = data.dropOffStep
        if data.qualificationResult:
            existing.qualification_qualified = data.qualificationResult.get("qualified")
            existing.qualification_severity = data.qualificationResult.get("severity")
            existing.qualification_message = data.qualificationResult.get("message")
        db.commit()
        return {"status": "updated", "id": str(existing.id)}

    session_obj = SalesAgentSession(
        lead_id=data.leadId,
        client_name=lead_data.get("name", "Unknown"),
        client_email=lead_data.get("email"),
        client_phone=lead_data.get("phone"),
        current_step=data.currentStep,
        status=data.status,
        outcome=data.outcome,
        exchanges=data.exchanges,
        started_at=data.startedAt,
        completed_at=data.completedAt,
        drop_off_step=data.dropOffStep,
    )
    if data.qualificationResult:
        session_obj.qualification_qualified = data.qualificationResult.get("qualified")
        session_obj.qualification_severity = data.qualificationResult.get("severity")
        session_obj.qualification_message = data.qualificationResult.get("message")

    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return {"status": "created", "id": str(session_obj.id)}


@router.get("/sales-sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Get a session by its frontend ID or lead ID."""
    obj = db.execute(
        select(SalesAgentSession).where(SalesAgentSession.lead_id == session_id)
        .order_by(SalesAgentSession.created_at.desc())
    ).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Session not found")
    return obj


@router.get("/sales-sessions")
def list_sessions(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List sessions for dashboard visibility."""
    stmt = select(SalesAgentSession).order_by(SalesAgentSession.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(SalesAgentSession.status == status)
    return list(db.execute(stmt).scalars().all())
