#!/usr/bin/env python

"""
Client Portal Lead Tracking + Follow-Up Endpoints
===================================================
Captures, qualifies, tracks, and follows up on leads from the client portal.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.client_portal_lead import (
    ClientPortalLeadCreate,
    ClientPortalLeadRead,
    ClientPortalLeadUpdate,
    FollowUpRead,
    FollowUpScheduleRequest,
    LeadTrackingMetrics,
    QualificationResult,
)
from app.services.client_portal_lead_service import ClientPortalLeadService

logger = logging.getLogger(__name__)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════
# Lead CRUD
# ══════════════════════════════════════════════════════════════════

@router.post("/leads", response_model=ClientPortalLeadRead)
def create_lead(
    data: ClientPortalLeadCreate,
    db: Session = Depends(get_db),
):
    """Create a new lead from the client portal intake or claim review request."""
    svc = ClientPortalLeadService(db)
    lead = svc.create_lead(data)
    return lead


@router.get("/leads", response_model=list[ClientPortalLeadRead])
def list_leads(
    status: Optional[str] = None,
    qualification_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List client portal leads with optional filtering."""
    svc = ClientPortalLeadService(db)
    return svc.list_leads(status=status, qualification_status=qualification_status, limit=limit, offset=offset)


@router.get("/leads/{lead_id}", response_model=ClientPortalLeadRead)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a single lead by ID."""
    svc = ClientPortalLeadService(db)
    lead = svc.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/leads/{lead_id}", response_model=ClientPortalLeadRead)
def update_lead(
    lead_id: UUID,
    updates: ClientPortalLeadUpdate,
    db: Session = Depends(get_db),
):
    """Update a lead's fields."""
    svc = ClientPortalLeadService(db)
    lead = svc.update_lead(lead_id, updates)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


# ══════════════════════════════════════════════════════════════════
# Qualification
# ══════════════════════════════════════════════════════════════════

@router.post("/leads/{lead_id}/qualify", response_model=QualificationResult)
def qualify_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Run qualification logic on a lead.
    Returns qualified/not_qualified with severity assessment and client-facing message.
    """
    svc = ClientPortalLeadService(db)
    return svc.qualify_lead(lead_id)


# ══════════════════════════════════════════════════════════════════
# Status Progression
# ══════════════════════════════════════════════════════════════════

@router.post("/leads/{lead_id}/progress", response_model=ClientPortalLeadRead)
def progress_lead_status(
    lead_id: UUID,
    status: str,
    db: Session = Depends(get_db),
):
    """
    Progress lead status: new → contacted → scheduled → signed → closed.
    """
    svc = ClientPortalLeadService(db)
    lead = svc.progress_status(lead_id, status)
    if not lead:
        raise HTTPException(status_code=400, detail="Invalid status or lead not found")
    return lead


# ══════════════════════════════════════════════════════════════════
# Follow-Up Scheduling
# ══════════════════════════════════════════════════════════════════

@router.post("/follow-up/schedule", response_model=FollowUpRead)
def schedule_follow_up(
    request: FollowUpScheduleRequest,
    db: Session = Depends(get_db),
):
    """Schedule a follow-up action (SMS, email, or voice) for a lead."""
    svc = ClientPortalLeadService(db)
    return svc.schedule_follow_up(request)


@router.post("/follow-up/process")
def process_due_follow_ups(
    db: Session = Depends(get_db),
):
    """
    Process all due follow-ups: scan leads where next_follow_up_at <= now,
    trigger the appropriate channel, update last_contact_at, and schedule next.

    In production, this is called by a Celery beat task.
    This endpoint allows manual triggering for testing.
    """
    svc = ClientPortalLeadService(db)
    due = svc.get_due_follow_ups()

    results = {"processed": 0, "sent": 0, "failed": 0}

    for fu in due:
        results["processed"] += 1
        try:
            # Dispatch based on channel
            if fu.channel == "sms":
                _send_sms(fu.lead, fu.message_text or "")
            elif fu.channel == "email":
                _send_email(fu.lead, fu.message_text or "")
            elif fu.channel == "voice":
                _trigger_voice(fu.lead, fu.message_text or "")

            svc.mark_follow_up_sent(fu.id, delivered=True)

            # Update lead's last contact
            if fu.lead:
                svc.progress_status(fu.lead.id, "contacted")

            results["sent"] += 1
            logger.info(f"Follow-up {fu.id} sent via {fu.channel} to lead {fu.lead_id}")

        except Exception as e:
            svc.mark_follow_up_failed(fu.id, str(e))
            results["failed"] += 1
            logger.error(f"Follow-up {fu.id} failed: {e}")

    return results


@router.post("/follow-up/cancel/{lead_id}")
def cancel_follow_ups(
    lead_id: UUID,
    db: Session = Depends(get_db),
):
    """Cancel all pending follow-ups for a lead."""
    svc = ClientPortalLeadService(db)
    count = svc.cancel_follow_ups_for_lead(lead_id)
    return {"cancelled": count}


# ══════════════════════════════════════════════════════════════════
# Dashboard Metrics
# ══════════════════════════════════════════════════════════════════

@router.get("/metrics", response_model=LeadTrackingMetrics)
def get_lead_metrics(
    db: Session = Depends(get_db),
):
    """Get dashboard metrics for the lead tracking system."""
    svc = ClientPortalLeadService(db)
    return svc.get_metrics()


# ══════════════════════════════════════════════════════════════════
# Channel Dispatch Helpers (replace with real integrations)
# ══════════════════════════════════════════════════════════════════

def _send_sms(lead, message: str) -> None:
    """Send SMS via Twilio. Currently logs for simulation."""
    logger.info(f"[SMS] To: {lead.phone if lead else 'N/A'} | Message: {message[:80]}...")
    # Future: Twilio client.messages.create(to=lead.phone, body=message, from_=TWILIO_NUMBER)


def _send_email(lead, message: str) -> None:
    """Send email via SendGrid/SES. Currently logs for simulation."""
    logger.info(f"[EMAIL] To: {lead.email if lead else 'N/A'} | Message: {message[:80]}...")
    # Future: email_client.send(to=lead.email, subject="Claim Update", body=message)


def _trigger_voice(lead, script: str) -> None:
    """Trigger AI voice call. Currently logs for simulation."""
    logger.info(f"[VOICE] To: {lead.phone if lead else 'N/A'} | Script: {script[:80]}...")
    # Future: voice_agent.initiate_call(phone=lead.phone, script=script)
