#!/usr/bin/env python

"""
UPA → ACI Outreach Funnel Service
==================================
Manages the multi-step outreach sequence and opt-out enforcement.

Sequence:
  1. Immediate SMS (UPA Initial)
  2. 15-min follow-up SMS if no reply
  3. Next-morning email if no reply
  4. On positive reply → contactStatus = aci_ready → transition message → ACI handoff
  5. STOP-word reply → full opt-out
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.communication_log import CommunicationLog
from app.models.incident import Incident
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.outreach_compliance_config import OutreachComplianceConfig
from app.models.outreach_template import OutreachTemplate
from app.utils.notifications import create_notification

logger = logging.getLogger(__name__)

# Default stop words — overridden by OutreachComplianceConfig.stop_word_list
DEFAULT_STOP_WORDS = {"STOP", "UNSUBSCRIBE", "REMOVE", "QUIT", "CANCEL", "END", "OPTOUT", "OPT OUT"}

# Keywords that signal the contact wants help / ACI handoff
POSITIVE_KEYWORDS = re.compile(
    r"\b(yes|help|claim|question|interested|please|call me|need help|file|damage)\b",
    re.IGNORECASE,
)

# ── Template variable rendering ──────────────────────────────────────

TEMPLATE_VARIABLES = {
    "first_name", "address", "incident_type", "incident_date",
    "organization_name", "agent_name", "reply_stop_line",
}

DEFAULT_REPLY_STOP_LINE = "Reply STOP to opt out."
DEFAULT_ORG_NAME = "UPA"


def render_template(body: str, context: dict[str, str]) -> str:
    """Replace {{var}} placeholders with context values."""
    for key, value in context.items():
        body = body.replace("{{" + key + "}}", value or "")
    return body


def build_template_context(
    lead: Lead,
    contact: LeadContact | None,
    incident: Incident | None = None,
    agent_name: str = "",
    org_name: str = DEFAULT_ORG_NAME,
) -> dict[str, str]:
    """Build variable context from lead/contact/incident."""
    first_name = ""
    address = ""
    if contact:
        full = contact.full_name or ""
        first_name = full.split()[0] if full else ""
        address = contact.address_loss or contact.address or ""

    incident_type = ""
    incident_date = ""
    if incident:
        incident_type = incident.incident_type or ""
        incident_date = (
            incident.occurred_at.strftime("%m/%d/%Y") if incident.occurred_at else ""
        )
    elif lead.peril:
        incident_type = lead.peril
        if lead.loss_date:
            incident_date = lead.loss_date.strftime("%m/%d/%Y")

    return {
        "first_name": first_name,
        "address": address,
        "incident_type": incident_type,
        "incident_date": incident_date,
        "organization_name": org_name,
        "agent_name": agent_name,
        "reply_stop_line": DEFAULT_REPLY_STOP_LINE,
    }


# ── Compliance helpers ───────────────────────────────────────────────

def get_compliance_config(db: Session) -> OutreachComplianceConfig | None:
    """Return the active compliance config row (or None)."""
    return db.execute(
        select(OutreachComplianceConfig)
        .where(OutreachComplianceConfig.is_active.is_(True))
        .order_by(OutreachComplianceConfig.created_at.desc())
    ).scalar_one_or_none()


def get_stop_words(db: Session) -> set[str]:
    """Return the configured stop-word set (uppercased)."""
    cfg = get_compliance_config(db)
    if cfg and cfg.stop_word_list:
        return {w.strip().upper() for w in cfg.stop_word_list.split(",") if w.strip()}
    return DEFAULT_STOP_WORDS


def is_outreach_paused(db: Session) -> bool:
    """Check whether the master outreach pause is active."""
    cfg = get_compliance_config(db)
    return bool(cfg and cfg.master_pause)


def is_contact_suppressed(contact: LeadContact | None, channel: str) -> bool:
    """Check if contact is opted out on the given channel."""
    if not contact:
        return False
    if channel == "sms":
        return bool(contact.sms_opt_out)
    if channel == "email":
        return bool(contact.email_opt_out)
    if channel == "voice":
        return bool(contact.voice_opt_out)
    return False


# ── Opt-out enforcement ──────────────────────────────────────────────

def apply_opt_out(db: Session, lead: Lead, contact: LeadContact | None) -> None:
    """Full opt-out: suppress across all channels, update lead status."""
    if contact:
        contact.sms_opt_out = True
        contact.email_opt_out = True
        contact.voice_opt_out = True
        contact.opt_out_at = datetime.now(timezone.utc)

    lead.contact_status = "opted_out"
    db.flush()
    logger.info("Opt-out applied for lead %s", lead.id)


def handle_stop_reply(db: Session, lead: Lead, contact: LeadContact | None) -> None:
    """Process a STOP reply: opt-out + send confirmation."""
    apply_opt_out(db, lead, contact)

    # Queue STOP confirmation SMS via Celery
    from app.core.celery_app import celery_app

    stop_template = db.execute(
        select(OutreachTemplate)
        .where(
            OutreachTemplate.name == "STOP Confirmation SMS",
            OutreachTemplate.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if stop_template and contact and contact.phone_number:
        ctx = build_template_context(lead, contact)
        rendered = render_template(stop_template.body, ctx)

        log = CommunicationLog(
            lead_id=lead.id,
            channel="sms",
            purpose="upa_stop_confirmation",
            direction="outbound",
            recipient_phone=contact.phone_number,
            body_preview=rendered[:500],
            send_status="pending",
        )
        db.add(log)
        db.flush()

        celery_app.send_task(
            "app.tasks.communication.send_tracked_sms_task",
            args=[str(log.id), rendered],
        )


# ── Positive reply → ACI handoff ────────────────────────────────────

def handle_positive_reply(db: Session, lead: Lead, contact: LeadContact | None) -> None:
    """Mark lead as aci_ready, send transition message, notify agent."""
    lead.contact_status = "aci_ready"
    lead.escalated_to_aci = True

    # Send transition SMS
    from app.core.celery_app import celery_app

    transition_template = db.execute(
        select(OutreachTemplate)
        .where(
            OutreachTemplate.name == "UPA Transition SMS",
            OutreachTemplate.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if transition_template and contact and contact.phone_number:
        ctx = build_template_context(lead, contact)
        rendered = render_template(transition_template.body, ctx)

        log = CommunicationLog(
            lead_id=lead.id,
            channel="sms",
            purpose="upa_transition",
            direction="outbound",
            recipient_phone=contact.phone_number,
            body_preview=rendered[:500],
            send_status="pending",
        )
        db.add(log)
        db.flush()

        celery_app.send_task(
            "app.tasks.communication.send_tracked_sms_task",
            args=[str(log.id), rendered],
        )

    # Send ACI handoff SMS
    handoff_template = db.execute(
        select(OutreachTemplate)
        .where(
            OutreachTemplate.name == "ACI Handoff SMS",
            OutreachTemplate.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if handoff_template and contact and contact.phone_number:
        ctx = build_template_context(lead, contact)
        rendered = render_template(handoff_template.body, ctx)

        log = CommunicationLog(
            lead_id=lead.id,
            channel="sms",
            purpose="aci_handoff",
            direction="outbound",
            recipient_phone=contact.phone_number,
            body_preview=rendered[:500],
            send_status="pending",
        )
        db.add(log)
        db.flush()

        celery_app.send_task(
            "app.tasks.communication.send_tracked_sms_task",
            args=[str(log.id), rendered],
        )

    # Notify assigned agent
    if lead.assigned_to:
        create_notification(
            db,
            user_id=lead.assigned_to,
            title="Lead Ready for ACI",
            message=f"Lead {lead.ref_number} has been escalated to ACI after positive outreach reply.",
            notification_type="aci_handoff",
            link="/app/leads/" + str(lead.id),
            lead_id=lead.id,
        )

    db.flush()
    logger.info("Lead %s escalated to ACI", lead.id)


# ── Inbound reply classifier ────────────────────────────────────────

def classify_inbound_reply(db: Session, lead_id: UUID, body: str) -> str:
    """Classify an inbound reply and take action.

    Returns: 'stop' | 'positive' | 'neutral'
    """
    lead = db.get(Lead, lead_id)
    if not lead:
        return "neutral"

    contact = lead.contact if hasattr(lead, "contact") else None

    # Update last reply
    lead.last_reply = body[:500] if body else None
    lead.last_outreach_at = datetime.now(timezone.utc)

    # Check for stop words
    stop_words = get_stop_words(db)
    body_upper = (body or "").strip().upper()
    for word in stop_words:
        if word in body_upper:
            handle_stop_reply(db, lead, contact)
            return "stop"

    # Check for positive intent
    if POSITIVE_KEYWORDS.search(body or ""):
        lead.contact_status = "engaged"
        handle_positive_reply(db, lead, contact)
        return "positive"

    # Neutral reply — mark as engaged
    if lead.contact_status in ("new", "sent"):
        lead.contact_status = "engaged"

    db.flush()
    return "neutral"
