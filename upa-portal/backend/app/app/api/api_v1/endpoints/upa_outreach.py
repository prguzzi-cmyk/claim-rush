#!/usr/bin/env python

"""
UPA → ACI Outreach Funnel API
==============================
Endpoints for outreach profiles (templates), campaign sequences,
compliance configuration, and opt-out management.
"""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app import models
from app.api.deps import get_current_active_user, get_db_session
from app.models.lead import Lead
from app.models.lead_contact import LeadContact
from app.models.outreach_compliance_config import OutreachComplianceConfig
from app.models.outreach_template import OutreachTemplate
from app.services.upa_outreach_service import (
    apply_opt_out,
    build_template_context,
    get_compliance_config,
    render_template,
)

router = APIRouter()


# ═══════════════════════════════════════════════
# OUTREACH PROFILES (template CRUD filtered for UPA)
# ═══════════════════════════════════════════════

UPA_TEMPLATE_NAMES = [
    "UPA Initial SMS",
    "UPA Follow-up SMS",
    "UPA Resource Email",
    "UPA Transition SMS",
    "ACI Handoff SMS",
    "STOP Confirmation SMS",
]


class OutreachProfileOut(BaseModel):
    id: str
    name: str
    channel: str
    subject: str | None = None
    body: str
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class OutreachProfileUpdate(BaseModel):
    name: str | None = None
    channel: str | None = None
    subject: str | None = None
    body: str | None = None
    is_active: bool | None = None


class TemplatePreviewRequest(BaseModel):
    body: str
    lead_id: str | None = None


@router.get("/profiles", summary="List UPA outreach profiles (templates)", response_model=list[OutreachProfileOut])
def list_profiles(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    print("[LIST] ========== list_profiles called ==========")
    rows = db_session.execute(
        select(OutreachTemplate).order_by(OutreachTemplate.created_at.desc())
    ).scalars().all()
    print(f"[LIST] Query returned {len(rows)} rows")
    for r in rows:
        print(f"[LIST]   id={r.id} name={r.name} channel={r.channel} active={r.is_active}")
    result = [_to_profile_out(t) for t in rows]
    return result


def _to_profile_out(t: OutreachTemplate) -> OutreachProfileOut:
    """Convert a SQLAlchemy OutreachTemplate to a serialisable Pydantic model."""
    return OutreachProfileOut(
        id=str(t.id),
        name=t.name,
        channel=t.channel,
        subject=t.subject,
        body=t.body,
        is_active=t.is_active,
        created_at=str(t.created_at) if t.created_at else None,
        updated_at=str(t.updated_at) if t.updated_at else None,
    )


@router.post(
    "/profiles",
    summary="Create UPA outreach profile",
    status_code=status.HTTP_201_CREATED,
    response_model=OutreachProfileOut,
)
def create_profile(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: OutreachProfileUpdate,
) -> Any:
    template = OutreachTemplate(
        name=obj_in.name or "Untitled",
        channel=obj_in.channel or "sms",
        subject=obj_in.subject,
        body=obj_in.body or "",
        is_active=obj_in.is_active if obj_in.is_active is not None else True,
        created_by_id=current_user.id,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)
    out = _to_profile_out(template)
    logger.info("[UPA-OUTREACH] create_profile OK: id=%s name=%s", out.id, out.name)
    return out


@router.put("/profiles/{profile_id}", summary="Update UPA outreach profile", response_model=OutreachProfileOut)
def update_profile(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    profile_id: UUID,
    obj_in: OutreachProfileUpdate,
) -> Any:
    template = db_session.get(OutreachTemplate, profile_id)
    if not template:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    db_session.commit()
    db_session.refresh(template)
    return _to_profile_out(template)


@router.delete("/profiles/{profile_id}", summary="Delete UPA outreach profile")
def delete_profile(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    profile_id: UUID,
) -> Any:
    template = db_session.get(OutreachTemplate, profile_id)
    if not template:
        raise HTTPException(status_code=404, detail="Profile not found")
    db_session.delete(template)
    db_session.commit()
    return {"ok": True}


@router.post("/profiles/preview", summary="Preview template with variables")
def preview_profile(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    req: TemplatePreviewRequest,
) -> Any:
    context = {
        "first_name": "Jane",
        "address": "123 Main St, Dallas TX",
        "incident_type": "Fire",
        "incident_date": "03/15/2026",
        "organization_name": "UPA",
        "agent_name": f"{current_user.first_name} {current_user.last_name}",
        "reply_stop_line": "Reply STOP to opt out.",
    }
    if req.lead_id:
        lead = db_session.get(Lead, req.lead_id)
        if lead and lead.contact:
            context = build_template_context(
                lead, lead.contact, agent_name=f"{current_user.first_name} {current_user.last_name}"
            )
    rendered = render_template(req.body, context)
    return {"rendered": rendered}


@router.post("/profiles/seed-defaults", summary="Seed default UPA outreach templates")
def seed_defaults(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create default UPA outreach templates. Returns all profiles after seeding."""
    print("[SEED] ========== seed_defaults called ==========")

    defaults = [
        {
            "name": "UPA Initial SMS",
            "channel": "sms",
            "body": "Hi {{first_name}}, this is {{agent_name}} with {{organization_name}}. We noticed a {{incident_type}} incident near {{address}} on {{incident_date}}. We help homeowners navigate the claims process at no upfront cost. Can we help? {{reply_stop_line}}",
        },
        {
            "name": "UPA Follow-up SMS",
            "channel": "sms",
            "body": "Hi {{first_name}}, just following up from {{organization_name}}. We're here to help with your {{incident_type}} claim. Would you like more info? {{reply_stop_line}}",
        },
        {
            "name": "UPA Resource Email",
            "channel": "email",
            "subject": "Resources for Your {{incident_type}} Claim — {{organization_name}}",
            "body": "Hi {{first_name}},\n\nWe're reaching out from {{organization_name}} regarding the {{incident_type}} incident near {{address}} on {{incident_date}}.\n\nOur team specializes in helping homeowners like you get fair settlements. We'd love to answer any questions.\n\nBest regards,\n{{agent_name}}\n{{organization_name}}",
        },
        {
            "name": "UPA Transition SMS",
            "channel": "sms",
            "body": "Great news, {{first_name}}! I'm connecting you with our claims specialist team at ACI to get your {{incident_type}} claim started. They'll be in touch shortly. {{reply_stop_line}}",
        },
        {
            "name": "ACI Handoff SMS",
            "channel": "sms",
            "body": "Hi {{first_name}}, this is ACI Claims. {{agent_name}} at {{organization_name}} let us know you need help with your {{incident_type}} claim. We're ready to assist — a specialist will reach out soon. {{reply_stop_line}}",
        },
        {
            "name": "STOP Confirmation SMS",
            "channel": "sms",
            "body": "You've been unsubscribed from {{organization_name}} messages. You will not receive further texts. If this was a mistake, reply START to re-subscribe.",
        },
    ]

    # Step 1: Check what already exists
    existing_rows = db_session.execute(select(OutreachTemplate)).scalars().all()
    existing_names = {t.name for t in existing_rows}
    print(f"[SEED] Existing templates in DB: {len(existing_rows)} — names: {existing_names}")

    # Step 2: Insert missing templates
    created_names = []
    for d in defaults:
        if d["name"] not in existing_names:
            t = OutreachTemplate(
                name=d["name"],
                channel=d["channel"],
                subject=d.get("subject"),
                body=d["body"],
                is_active=True,
                created_by_id=current_user.id,
            )
            db_session.add(t)
            created_names.append(d["name"])
            print(f"[SEED] Adding: {d['name']}")
        else:
            print(f"[SEED] Skipping (exists): {d['name']}")

    # Step 3: Commit
    try:
        db_session.commit()
        print(f"[SEED] Commit OK — created {len(created_names)}")
    except Exception as exc:
        db_session.rollback()
        print(f"[SEED] Commit FAILED: {exc}")
        raise HTTPException(status_code=500, detail=f"DB commit failed: {exc}")

    # Step 4: Re-query to return what's actually in the DB now
    all_rows = db_session.execute(
        select(OutreachTemplate).order_by(OutreachTemplate.created_at.desc())
    ).scalars().all()
    print(f"[SEED] After commit, total templates in DB: {len(all_rows)}")
    for r in all_rows:
        print(f"[SEED]   id={r.id} name={r.name} channel={r.channel}")

    result = [_to_profile_out(t) for t in all_rows]
    return {"seeded": created_names, "all_profiles": result, "total": len(result)}


# ═══════════════════════════════════════════════
# CAMPAIGN SEQUENCE
# ═══════════════════════════════════════════════

class SequenceStepOut(BaseModel):
    step: int
    name: str
    channel: str
    delay_label: str
    trigger: str


@router.get("/sequence", summary="Get UPA outreach sequence definition")
def get_sequence(
    *,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return the fixed UPA outreach sequence steps."""
    return [
        {"step": 1, "name": "UPA Initial SMS", "channel": "sms", "delay_label": "Immediate", "trigger": "new_lead"},
        {"step": 2, "name": "UPA Follow-up SMS", "channel": "sms", "delay_label": "15 min", "trigger": "no_reply"},
        {"step": 3, "name": "UPA Resource Email", "channel": "email", "delay_label": "Next morning", "trigger": "no_reply"},
        {"step": 4, "name": "Reply Detection", "channel": "system", "delay_label": "On reply", "trigger": "positive_reply"},
        {"step": 5, "name": "UPA Transition SMS", "channel": "sms", "delay_label": "Immediate", "trigger": "aci_ready"},
        {"step": 6, "name": "ACI Handoff SMS", "channel": "sms", "delay_label": "Immediate", "trigger": "aci_ready"},
    ]


# ═══════════════════════════════════════════════
# OPT-OUT MANAGEMENT
# ═══════════════════════════════════════════════

class OptOutRequest(BaseModel):
    lead_id: str
    channels: list[str] | None = None  # ["sms", "email", "voice"] — None = all


class OptOutStatusOut(BaseModel):
    lead_id: str
    sms_opt_out: bool
    email_opt_out: bool
    voice_opt_out: bool
    contact_status: str | None
    opt_out_at: str | None


@router.post("/opt-out", summary="Opt out a lead from outreach")
def opt_out_lead(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    req: OptOutRequest,
) -> Any:
    lead = db_session.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    contact = lead.contact if hasattr(lead, "contact") else None
    channels = req.channels or ["sms", "email", "voice"]

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if contact:
        if "sms" in channels:
            contact.sms_opt_out = True
        if "email" in channels:
            contact.email_opt_out = True
        if "voice" in channels:
            contact.voice_opt_out = True
        contact.opt_out_at = now

    # If all channels opted out, set contact_status
    if contact and contact.sms_opt_out and contact.email_opt_out and contact.voice_opt_out:
        lead.contact_status = "opted_out"

    db_session.commit()
    return {"ok": True, "lead_id": req.lead_id}


@router.post("/opt-in", summary="Re-opt-in a lead for outreach")
def opt_in_lead(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    req: OptOutRequest,
) -> Any:
    lead = db_session.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    contact = lead.contact if hasattr(lead, "contact") else None
    channels = req.channels or ["sms", "email", "voice"]

    if contact:
        if "sms" in channels:
            contact.sms_opt_out = False
        if "email" in channels:
            contact.email_opt_out = False
        if "voice" in channels:
            contact.voice_opt_out = False
        contact.opt_out_at = None

    if lead.contact_status == "opted_out":
        lead.contact_status = "new"

    db_session.commit()
    return {"ok": True, "lead_id": req.lead_id}


@router.get("/opt-out/{lead_id}", summary="Get lead opt-out status")
def get_opt_out_status(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: UUID,
) -> Any:
    lead = db_session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    contact = lead.contact if hasattr(lead, "contact") else None
    return {
        "lead_id": str(lead_id),
        "sms_opt_out": contact.sms_opt_out if contact else False,
        "email_opt_out": contact.email_opt_out if contact else False,
        "voice_opt_out": contact.voice_opt_out if contact else False,
        "contact_status": lead.contact_status,
        "opt_out_at": str(contact.opt_out_at) if contact and contact.opt_out_at else None,
    }


# ═══════════════════════════════════════════════
# COMPLIANCE CONFIG
# ═══════════════════════════════════════════════

class ComplianceConfigUpdate(BaseModel):
    master_pause: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    quiet_hours_tz: str | None = None
    stop_word_list: str | None = None
    auto_suppress_enabled: bool | None = None
    max_daily_sms_per_lead: int | None = None
    max_daily_emails_per_lead: int | None = None


class ComplianceConfigOut(BaseModel):
    id: str
    master_pause: bool
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str
    quiet_hours_tz: str
    stop_word_list: str
    auto_suppress_enabled: bool
    max_daily_sms_per_lead: int
    max_daily_emails_per_lead: int

    class Config:
        from_attributes = True


@router.get("/compliance", summary="Get outreach compliance config")
def get_compliance(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    cfg = get_compliance_config(db_session)
    if not cfg:
        # Create default config
        cfg = OutreachComplianceConfig(is_active=True)
        db_session.add(cfg)
        db_session.commit()
        db_session.refresh(cfg)
    return cfg


@router.put("/compliance", summary="Update outreach compliance config")
def update_compliance(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: ComplianceConfigUpdate,
) -> Any:
    cfg = get_compliance_config(db_session)
    if not cfg:
        cfg = OutreachComplianceConfig(is_active=True)
        db_session.add(cfg)
        db_session.flush()

    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(cfg, field, value)

    db_session.commit()
    db_session.refresh(cfg)
    return cfg


# ═══════════════════════════════════════════════
# FUNNEL METRICS
# ═══════════════════════════════════════════════

@router.get("/funnel-metrics", summary="Get UPA → ACI funnel metrics")
def get_funnel_metrics(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return counts by contact_status for the funnel view."""
    from sqlalchemy import func

    results = db_session.execute(
        select(Lead.contact_status, func.count(Lead.id))
        .where(Lead.routing_bucket.in_(["ACI_LEAD", "UPA_OUTREACH"]))
        .group_by(Lead.contact_status)
    ).all()

    metrics = {
        "new": 0, "sent": 0, "engaged": 0,
        "opted_out": 0, "aci_ready": 0, "closed": 0, "total": 0,
    }
    for status_val, count in results:
        key = status_val or "new"
        if key in metrics:
            metrics[key] = count
        metrics["total"] += count

    return metrics
