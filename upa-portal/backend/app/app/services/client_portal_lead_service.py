#!/usr/bin/env python

"""
Client Portal Lead Service
===========================
Handles lead creation, qualification, follow-up scheduling,
and status progression for leads originating from the client portal.

This is the foundation of the revenue generation pipeline.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.client_portal_lead import ClientPortalFollowUp, ClientPortalLead
from app.schemas.client_portal_lead import (
    ClientPortalLeadCreate,
    ClientPortalLeadUpdate,
    FollowUpScheduleRequest,
    LeadTrackingMetrics,
    QualificationResult,
)

logger = logging.getLogger(__name__)

# ── Follow-up message templates ───────────────────────────────────

FOLLOW_UP_MESSAGES = {
    "reminder_photos": "We're here when you're ready to continue your claim. Upload a few photos to get started.",
    "reminder_continue": "Your photos are uploaded. Continue when you're ready — we'll guide you through the next steps.",
    "reminder_schedule": "We're ready to review your claim whenever you are. Schedule a time that works for you.",
    "reengage_insights": "Many claims benefit from a closer review — you can continue anytime.",
    "reengage_general": "Your claim is still open. Continue anytime — we're here to help.",
    "reinforce_scheduled": "We're looking forward to reviewing your claim with you.",
    "reinforce_missed": "We missed you. Would you like to reschedule your claim review?",
}


class ClientPortalLeadService:
    def __init__(self, db: Session):
        self.db = db

    # ══════════════════════════════════════════════════════════════
    # 1. Lead CRUD
    # ══════════════════════════════════════════════════════════════

    def create_lead(self, data: ClientPortalLeadCreate) -> ClientPortalLead:
        """Create a new lead from the client portal flow."""
        lead = ClientPortalLead(
            name=data.name,
            email=data.email,
            phone=data.phone,
            address=data.address,
            incident_type=data.incident_type,
            claim_number=data.claim_number,
            photo_count=data.photo_count,
            has_3d_scan=data.has_3d_scan,
            source=data.source,
            source_site=data.source_site,
            message=data.message,
            status="new",
            qualification_status="pending",
        )
        self.db.add(lead)
        self.db.commit()
        self.db.refresh(lead)
        logger.info(f"Client portal lead created: {lead.id} ({lead.name})")
        return lead

    def update_lead(self, lead_id: UUID, updates: ClientPortalLeadUpdate) -> Optional[ClientPortalLead]:
        """Update an existing lead."""
        lead = self.db.get(ClientPortalLead, lead_id)
        if not lead:
            return None
        for field, value in updates.model_dump(exclude_unset=True).items():
            setattr(lead, field, value)
        self.db.commit()
        self.db.refresh(lead)
        return lead

    def get_lead(self, lead_id: UUID) -> Optional[ClientPortalLead]:
        """Get a single lead by ID."""
        return self.db.get(ClientPortalLead, lead_id)

    def list_leads(
        self,
        status: Optional[str] = None,
        qualification_status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ClientPortalLead]:
        """List leads with optional filtering."""
        stmt = select(ClientPortalLead).where(ClientPortalLead.is_removed == False)
        if status:
            stmt = stmt.where(ClientPortalLead.status == status)
        if qualification_status:
            stmt = stmt.where(ClientPortalLead.qualification_status == qualification_status)
        stmt = stmt.order_by(ClientPortalLead.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.execute(stmt).scalars().all())

    # ══════════════════════════════════════════════════════════════
    # 2. Qualification Logic
    # ══════════════════════════════════════════════════════════════

    def qualify_lead(self, lead_id: UUID) -> QualificationResult:
        """
        Two-step qualification:
        Step 1: System evaluates claim type, severity, and service criteria.
        Step 2: Returns qualification status with appropriate messaging.

        Future: integrate AI scoring model for smarter qualification.
        """
        lead = self.db.get(ClientPortalLead, lead_id)
        if not lead:
            return QualificationResult(
                qualified=False,
                qualification_status="not_qualified",
                severity=None,
                notes="Lead not found",
                message="We were unable to locate your claim information.",
            )

        # Evaluate severity based on available data
        severity = self._estimate_severity(lead)

        # Qualification criteria
        qualified = self._meets_qualification_criteria(lead, severity)

        if qualified:
            lead.qualification_status = "qualified"
            lead.estimated_severity = severity
            lead.qualification_notes = f"Auto-qualified: {lead.incident_type or 'general'} claim, severity={severity}, photos={lead.photo_count}"
            self.db.commit()

            return QualificationResult(
                qualified=True,
                qualification_status="qualified",
                severity=severity,
                notes=lead.qualification_notes,
                message="Based on the information provided, your situation appears to qualify for our review.",
            )
        else:
            lead.qualification_status = "not_qualified"
            lead.qualification_notes = f"Did not meet criteria: severity={severity}, photos={lead.photo_count}"
            self.db.commit()

            return QualificationResult(
                qualified=False,
                qualification_status="not_qualified",
                severity=severity,
                notes=lead.qualification_notes,
                message="At this time, your situation may not require our services, but we're happy to provide general guidance.",
            )

    def _estimate_severity(self, lead: ClientPortalLead) -> str:
        """Estimate damage severity from available data."""
        score = 0

        # Photo coverage
        if lead.photo_count >= 8:
            score += 3
        elif lead.photo_count >= 4:
            score += 2
        elif lead.photo_count > 0:
            score += 1

        # 3D scan indicates thoroughness
        if lead.has_3d_scan:
            score += 2

        # Incident type weighting
        high_severity_types = {"fire", "flood", "hurricane", "tornado"}
        moderate_types = {"storm", "hail", "wind", "water"}
        if lead.incident_type and lead.incident_type.lower() in high_severity_types:
            score += 3
        elif lead.incident_type and lead.incident_type.lower() in moderate_types:
            score += 2

        if score >= 6:
            return "critical"
        if score >= 4:
            return "high"
        if score >= 2:
            return "moderate"
        return "low"

    def _meets_qualification_criteria(self, lead: ClientPortalLead, severity: str) -> bool:
        """Determine if a lead meets service criteria."""
        # Must have some documentation
        if lead.photo_count == 0 and not lead.has_3d_scan:
            return False

        # Must be at least moderate severity
        if severity == "low":
            return False

        return True

    # ══════════════════════════════════════════════════════════════
    # 3. Status Progression
    # ══════════════════════════════════════════════════════════════

    def progress_status(self, lead_id: UUID, new_status: str) -> Optional[ClientPortalLead]:
        """
        Progress lead status: new → contacted → scheduled → signed → closed.
        Updates last_contact_at timestamp.
        """
        valid_statuses = {"new", "contacted", "scheduled", "signed", "closed"}
        if new_status not in valid_statuses:
            return None

        lead = self.db.get(ClientPortalLead, lead_id)
        if not lead:
            return None

        lead.status = new_status
        lead.last_contact_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(lead)

        logger.info(f"Lead {lead_id} progressed to status: {new_status}")
        return lead

    # ══════════════════════════════════════════════════════════════
    # 4. Follow-Up Scheduling
    # ══════════════════════════════════════════════════════════════

    def schedule_follow_up(self, request: FollowUpScheduleRequest) -> ClientPortalFollowUp:
        """Schedule a follow-up action for a lead."""
        message_text = request.message_text or FOLLOW_UP_MESSAGES.get(request.message_key or "", "")

        follow_up = ClientPortalFollowUp(
            lead_id=request.lead_id,
            follow_up_type=request.follow_up_type,
            channel=request.channel,
            message_key=request.message_key,
            message_text=message_text,
            scheduled_at=datetime.now(timezone.utc) + timedelta(minutes=request.delay_minutes),
            status="pending",
        )
        self.db.add(follow_up)

        # Update lead's next follow-up timestamp
        lead = self.db.get(ClientPortalLead, request.lead_id)
        if lead:
            lead.next_follow_up_at = follow_up.scheduled_at
            lead.follow_up_count = (lead.follow_up_count or 0) + 1

        self.db.commit()
        self.db.refresh(follow_up)
        logger.info(f"Follow-up scheduled: {follow_up.id} for lead {request.lead_id} via {request.channel} in {request.delay_minutes}min")
        return follow_up

    def get_due_follow_ups(self) -> list[ClientPortalFollowUp]:
        """Get all follow-ups where scheduled_at <= now and status == 'pending'."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(ClientPortalFollowUp)
            .where(and_(
                ClientPortalFollowUp.status == "pending",
                ClientPortalFollowUp.scheduled_at <= now,
            ))
            .order_by(ClientPortalFollowUp.scheduled_at.asc())
            .limit(100)
        )
        return list(self.db.execute(stmt).scalars().all())

    def mark_follow_up_sent(self, follow_up_id: UUID, delivered: bool = False) -> None:
        """Mark a follow-up as sent (or delivered)."""
        fu = self.db.get(ClientPortalFollowUp, follow_up_id)
        if fu:
            fu.status = "delivered" if delivered else "sent"
            fu.sent_at = datetime.now(timezone.utc)
            if delivered:
                fu.delivered_at = datetime.now(timezone.utc)
            self.db.commit()

    def mark_follow_up_failed(self, follow_up_id: UUID, reason: str) -> None:
        """Mark a follow-up as failed."""
        fu = self.db.get(ClientPortalFollowUp, follow_up_id)
        if fu:
            fu.status = "failed"
            fu.failure_reason = reason
            self.db.commit()

    def cancel_follow_ups_for_lead(self, lead_id: UUID) -> int:
        """Cancel all pending follow-ups for a lead."""
        stmt = (
            select(ClientPortalFollowUp)
            .where(and_(
                ClientPortalFollowUp.lead_id == lead_id,
                ClientPortalFollowUp.status == "pending",
            ))
        )
        pending = self.db.execute(stmt).scalars().all()
        count = 0
        for fu in pending:
            fu.status = "cancelled"
            count += 1
        self.db.commit()
        return count

    # ══════════════════════════════════════════════════════════════
    # 5. Dashboard Metrics
    # ══════════════════════════════════════════════════════════════

    def get_metrics(self) -> LeadTrackingMetrics:
        """Compute dashboard metrics for lead tracking."""
        base = select(ClientPortalLead).where(ClientPortalLead.is_removed == False)

        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0

        def count_status(status: str) -> int:
            return self.db.execute(
                select(func.count()).select_from(
                    base.where(ClientPortalLead.status == status).subquery()
                )
            ).scalar() or 0

        def count_qual(qs: str) -> int:
            return self.db.execute(
                select(func.count()).select_from(
                    base.where(ClientPortalLead.qualification_status == qs).subquery()
                )
            ).scalar() or 0

        signed = count_status("signed")
        contacted = count_status("contacted")

        # Follow-ups
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        pending_fus = self.db.execute(
            select(func.count()).select_from(
                select(ClientPortalFollowUp)
                .where(ClientPortalFollowUp.status == "pending")
                .subquery()
            )
        ).scalar() or 0

        sent_today = self.db.execute(
            select(func.count()).select_from(
                select(ClientPortalFollowUp)
                .where(and_(
                    ClientPortalFollowUp.status.in_(["sent", "delivered"]),
                    ClientPortalFollowUp.sent_at >= today_start,
                ))
                .subquery()
            )
        ).scalar() or 0

        conversion_rate = (signed / total * 100) if total > 0 else 0.0

        return LeadTrackingMetrics(
            total_leads=total,
            leads_new=count_status("new"),
            leads_contacted=contacted,
            leads_scheduled=count_status("scheduled"),
            leads_signed=signed,
            leads_qualified=count_qual("qualified"),
            leads_not_qualified=count_qual("not_qualified"),
            appointments_scheduled=count_status("scheduled"),
            conversion_rate=round(conversion_rate, 1),
            follow_ups_pending=pending_fus,
            follow_ups_sent_today=sent_today,
        )
