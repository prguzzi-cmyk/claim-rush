#!/usr/bin/env python

"""Routes for the AI Intake Assistant module"""

import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import get_current_active_user, get_db_session

logger = logging.getLogger(__name__)
from app.crud.crud_intake_session import intake_session as crud_intake_session
from app.crud.crud_intake_appointment import intake_appointment as crud_intake_appointment
from app.models.intake_session import IntakeSession
from app.models.intake_appointment import IntakeAppointment
from app.schemas.intake_session import (
    IntakeChatMessage,
    IntakeChatResponse,
    IntakeDashboardMetrics,
    IntakeSessionCreate,
    IntakeSessionUpdate,
    IntakeStep,
)
from app.schemas.intake_appointment import (
    IntakeAppointmentCreate,
    IntakeAppointment as IntakeAppointmentSchema,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# AI Conversation Engine
# ─────────────────────────────────────────────────────────────

# Step definitions with prompts
STEP_CONFIG = {
    IntakeStep.GREETING: {
        "prompt": (
            "Hi, I'm your ACI Claim Assistant. I know dealing with property damage "
            "can be stressful — I'm here to help guide you through what your insurance "
            "may cover and what steps you can take.\n\n"
            "I'll ask a few quick questions so our team can review your situation and "
            "help you understand your options. Most homeowners we work with find their "
            "policies cover more than they initially expected.\n\n"
            "Let's get started — what's your full name?"
        ),
        "field": None,
        "next": IntakeStep.NAME,
    },
    IntakeStep.NAME: {
        "prompt": (
            "Got it — thank you, {homeowner_name}. I'll keep everything organized "
            "under your name so nothing falls through the cracks.\n\n"
            "What's the address of the property that was affected?"
        ),
        "field": "homeowner_name",
        "next": IntakeStep.ADDRESS,
    },
    IntakeStep.ADDRESS: {
        "prompt": (
            "Perfect, I've got that noted. That helps us understand your area and any "
            "recent weather events that may apply.\n\n"
            "What's the best phone number to reach you? We'll only use it to keep "
            "you updated on your case — no spam, ever."
        ),
        "field": "property_address",
        "next": IntakeStep.CONTACT,
    },
    IntakeStep.CONTACT: {
        "prompt": (
            "Thanks — that's really helpful. And what's your email address? "
            "I'll send you a summary of everything we cover today so you have it "
            "for your records."
        ),
        "field": "phone",
        "next": IntakeStep.INCIDENT,
    },
    IntakeStep.INCIDENT: {
        "prompt": (
            "Appreciate that — you're making this easy.\n\n"
            "Now, can you tell me what happened to your property? For example:\n"
            "• Wind or Hail damage\n"
            "• Fire or Smoke\n"
            "• Water or Flooding\n"
            "• Hurricane or Tornado\n"
            "• Theft or Vandalism\n"
            "• Something else\n\n"
            "Don't worry about getting the exact category — just describe what you saw "
            "and I'll take it from there."
        ),
        "field": "email",
        "next": IntakeStep.DATE_OF_LOSS,
    },
    IntakeStep.DATE_OF_LOSS: {
        "prompt": (
            "I'm sorry to hear that — dealing with that kind of damage is never easy. "
            "The good news is, this is exactly the kind of situation we help homeowners "
            "navigate every day.\n\n"
            "When did the damage happen? An approximate date works fine "
            "(e.g., March 5, 2026)."
        ),
        "field": "incident_type",
        "next": IntakeStep.INSURANCE,
    },
    IntakeStep.INSURANCE: {
        "prompt": (
            "Got it — that timeline is really helpful for understanding your filing window.\n\n"
            "Which insurance company covers this property? Knowing your carrier helps "
            "us understand what your policy likely covers and how to help you "
            "maximize your claim."
        ),
        "field": "date_of_loss",
        "next": IntakeStep.POLICY,
    },
    IntakeStep.POLICY: {
        "prompt": (
            "Good to know — we've helped many homeowners with that carrier navigate "
            "their claims successfully.\n\n"
            "Do you have your policy number handy? If not, no worries at all — "
            "just type 'skip' and our team can look it up for you.\n\n"
            "Once we wrap this up, we can have one of our specialists review your "
            "situation and walk you through your options."
        ),
        "field": "insurance_company",
        "next": IntakeStep.QUALIFICATION,
    },
    IntakeStep.QUALIFICATION: {
        "prompt": None,  # Dynamic — set by qualification logic
        "field": "policy_number",
        "next": IntakeStep.APPOINTMENT,
    },
    IntakeStep.APPOINTMENT: {
        "prompt": (
            "Would you like to schedule a free consultation? There's no obligation "
            "— it's just a chance to have an expert look at your situation.\n\n"
            "We offer:\n"
            "1. In-person property inspection\n"
            "2. Zoom video consultation\n"
            "3. Microsoft Teams consultation\n\n"
            "Just reply 1, 2, or 3. Or type 'no' if you'd prefer we call you."
        ),
        "field": None,
        "next": IntakeStep.COMPLETE,
    },
    IntakeStep.COMPLETE: {
        "prompt": (
            "You're all set, and I want you to know — you've taken a great first step.\n\n"
            "Here's what we collected:\n\n{summary}\n\n"
            "Our team will review your case and be in touch within 24 hours. "
            "Many homeowners in similar situations end up recovering more than they "
            "expected once their policy is properly reviewed.\n\n"
            "Thank you for trusting ACI — we're in your corner!"
        ),
        "field": None,
        "next": None,
    },
}

# Perils that qualify for representation
QUALIFYING_PERILS = {
    "wind", "hail", "wind / hail", "fire", "water", "flood", "water / flood",
    "hurricane", "tornado", "theft", "vandalism", "theft / vandalism",
    "lightning", "smoke", "ice", "snow", "tree damage",
}


def _qualify_claim(session_data: dict) -> tuple[bool, str, float]:
    """Determine if a claim is viable based on collected data."""
    score = 0.0
    reasons = []

    # Check incident type
    incident = (session_data.get("incident_type") or "").lower().strip()
    if any(p in incident for p in QUALIFYING_PERILS):
        score += 40
    else:
        reasons.append(f"Incident type '{incident}' may not be covered under standard policies.")

    # Check insurance company presence
    insurance = session_data.get("insurance_company") or ""
    if insurance.strip():
        score += 30
    else:
        reasons.append("No insurance company provided.")

    # Check date of loss (must be within last 2 years for most policies)
    date_str = session_data.get("date_of_loss") or ""
    if date_str:
        try:
            loss_date = datetime.fromisoformat(date_str) if isinstance(date_str, str) else date_str
            days_ago = (datetime.now(timezone.utc) - loss_date.replace(tzinfo=timezone.utc)).days
            if days_ago <= 730:  # 2 years
                score += 20
            else:
                reasons.append("Date of loss exceeds typical policy filing window (2 years).")
        except (ValueError, TypeError):
            score += 10  # Partial credit — we have a date, just couldn't parse

    # Policy number bonus
    policy = session_data.get("policy_number") or ""
    if policy.strip() and policy.lower() != "skip":
        score += 10

    is_qualified = score >= 50
    reason = "Claim meets qualification criteria." if is_qualified else " ".join(reasons)
    return is_qualified, reason, score


def _build_summary(data: dict) -> str:
    """Build a human-readable summary of collected intake data."""
    lines = []
    if data.get("homeowner_name"):
        lines.append(f"Name: {data['homeowner_name']}")
    if data.get("property_address"):
        lines.append(f"Property: {data['property_address']}")
    if data.get("phone"):
        lines.append(f"Phone: {data['phone']}")
    if data.get("email"):
        lines.append(f"Email: {data['email']}")
    if data.get("incident_type"):
        lines.append(f"Incident: {data['incident_type']}")
    if data.get("date_of_loss"):
        lines.append(f"Date of Loss: {data['date_of_loss']}")
    if data.get("insurance_company"):
        lines.append(f"Insurance: {data['insurance_company']}")
    if data.get("policy_number") and data["policy_number"].lower() != "skip":
        lines.append(f"Policy #: {data['policy_number']}")
    return "\n".join(lines) if lines else "No data collected."


def _get_collected_data(session_obj) -> dict:
    """Extract collected fields from a session object into a dict."""
    return {
        "homeowner_name": session_obj.homeowner_name,
        "property_address": session_obj.property_address,
        "phone": session_obj.phone,
        "email": session_obj.email,
        "incident_type": session_obj.incident_type,
        "date_of_loss": str(session_obj.date_of_loss) if session_obj.date_of_loss else None,
        "insurance_company": session_obj.insurance_company,
        "policy_number": session_obj.policy_number,
    }


def _append_to_log(existing_log: str | None, role: str, text: str) -> str:
    """Append a message to the JSON conversation log."""
    try:
        log = json.loads(existing_log) if existing_log else []
    except (json.JSONDecodeError, TypeError):
        log = []
    log.append({"role": role, "text": text, "ts": datetime.now(timezone.utc).isoformat()})
    return json.dumps(log)


# ─────────────────────────────────────────────────────────────
# Chat Endpoint
# ─────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    summary="Send a message to the AI Intake Assistant",
    response_model=IntakeChatResponse,
)
def chat(
    *,
    body: IntakeChatMessage,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Process a homeowner message and return the next AI response.
    Pass session_id=null to start a new conversation.

    This endpoint NEVER returns a 500. All errors are caught and
    a safe fallback response is returned with fallback=True.
    """
    try:
        return _chat_inner(body, db_session, current_user)
    except Exception as exc:
        action = "start_session" if body.session_id is None else f"send_message(session={body.session_id})"
        logger.error(
            "AI Intake chat failed | action=%s | error=%s\n%s",
            action, str(exc), traceback.format_exc(),
        )
        # Last-resort recovery: create a fresh session so the user
        # is never left staring at a 500 error.  The greeting shown is
        # the normal one — no error text is surfaced to the user.
        recovery_id = _try_emergency_session(db_session, current_user)
        greeting = STEP_CONFIG[IntakeStep.GREETING]["prompt"]
        return IntakeChatResponse(
            success=True,
            session_id=recovery_id,
            ai_message=greeting,
            current_step=IntakeStep.NAME.value,
            is_complete=False,
            collected_data={},
            fallback=True,
        )


def _try_emergency_session(
    db_session: Session, current_user: Any,
) -> UUID | None:
    """Last-resort session creation — must never raise."""
    try:
        with db_session as session:
            emergency = IntakeSession(
                status="active",
                current_step=IntakeStep.NAME.value,
                created_by_user_id=current_user.id,
                conversation_log=_append_to_log("[]", "ai", "Session recovered after error."),
            )
            session.add(emergency)
            session.commit()
            session.refresh(emergency)
            logger.info("AI Intake: emergency session created id=%s", emergency.id)
            return emergency.id
    except Exception as inner:
        logger.error("AI Intake: emergency session creation failed: %s", inner)
        return None


def _create_new_session(
    session: Session,
    current_user: Any,
    *,
    fallback: bool = False,
) -> IntakeChatResponse:
    """Create a brand new intake session. Used both for normal starts
    and for auto-recovery when a session_id can't be found."""
    label = "recovered" if fallback else "new"
    logger.info("AI Intake: creating %s session for user %s", label, current_user.id)

    new_session = IntakeSession(
        status="active",
        current_step=IntakeStep.GREETING.value,
        created_by_user_id=current_user.id,
        conversation_log="[]",
    )
    session.add(new_session)
    session.flush()

    # Always show the normal greeting — never surface recovery text
    greeting = STEP_CONFIG[IntakeStep.GREETING]["prompt"]

    new_session.conversation_log = _append_to_log(
        new_session.conversation_log, "ai", greeting
    )
    new_session.current_step = IntakeStep.NAME.value
    session.commit()
    session.refresh(new_session)

    logger.info("AI Intake: session created id=%s (fallback=%s)", new_session.id, fallback)
    return IntakeChatResponse(
        success=True,
        session_id=new_session.id,
        ai_message=greeting,
        current_step=IntakeStep.NAME.value,
        is_complete=False,
        collected_data={},
        fallback=fallback,
    )


def _chat_inner(
    body: IntakeChatMessage,
    db_session: Session,
    current_user: Any,
) -> IntakeChatResponse:
    """Inner chat logic — separated for clean error handling."""
    with db_session as session:

        # ── Input guard: empty message on a new session ──
        if body.session_id is None and not (body.message or "").strip():
            # Treat empty message + no session as "start new conversation"
            logger.info("AI Intake: empty message with no session — auto-starting for user %s", current_user.id)

        # ── Start new session (session_id is None) ──
        if body.session_id is None:
            return _create_new_session(session, current_user)

        # ── Input guard: empty message on existing session ──
        if not (body.message or "").strip():
            logger.info("AI Intake: empty message for session %s — returning safe response", body.session_id)
            intake = session.get(IntakeSession, body.session_id)
            if intake:
                return IntakeChatResponse(
                    success=True,
                    session_id=intake.id,
                    ai_message="I didn't catch that — could you please try again?",
                    current_step=intake.current_step,
                    is_complete=False,
                    collected_data=_get_collected_data(intake),
                )
            # Session not found — fall through to recreation below

        # ── Continue existing session ──
        logger.info("AI Intake: message for session %s, step=continue", body.session_id)
        intake = session.get(IntakeSession, body.session_id)
        if not intake:
            # Auto-recreate the session instead of returning an error
            logger.warning(
                "AI Intake: session not found id=%s — auto-recreating",
                body.session_id,
            )
            return _create_new_session(session, current_user, fallback=True)

        # Guard against corrupted current_step values
        try:
            current_step = IntakeStep(intake.current_step)
        except ValueError:
            logger.warning(
                "AI Intake: invalid step '%s' on session %s — resetting to NAME",
                intake.current_step, intake.id,
            )
            intake.current_step = IntakeStep.NAME.value
            current_step = IntakeStep.NAME

        user_msg = body.message.strip()

        # Log user message
        intake.conversation_log = _append_to_log(
            intake.conversation_log, "user", user_msg
        )

        # ── Store the field from the current step ──
        step_cfg = STEP_CONFIG.get(current_step, {})
        field = step_cfg.get("field")
        if field:
            if field == "date_of_loss":
                # Try to parse date, store as-is if it fails
                try:
                    parsed = datetime.fromisoformat(user_msg)
                    setattr(intake, field, parsed)
                except ValueError:
                    # Store raw string for manual review
                    intake.date_of_loss = None
                    # Keep the raw value in the log
            elif field == "policy_number" and user_msg.lower() == "skip":
                intake.policy_number = None
            else:
                setattr(intake, field, user_msg)

        # ── Determine next step ──
        next_step = step_cfg.get("next")

        # ── Handle qualification step ──
        if next_step == IntakeStep.QUALIFICATION or current_step == IntakeStep.QUALIFICATION:
            if current_step != IntakeStep.QUALIFICATION:
                # We just arrived at qualification — run it
                collected = _get_collected_data(intake)
                is_qualified, reason, score = _qualify_claim(collected)
                intake.is_qualified = is_qualified
                intake.qualification_reason = reason
                intake.qualification_score = score

                name = intake.homeowner_name or 'there'
                has_insurance = bool((intake.insurance_company or '').strip())

                appt_menu = (
                    "1. In-person property inspection\n"
                    "2. Zoom video consultation\n"
                    "3. Microsoft Teams consultation\n\n"
                    "Just reply 1, 2, or 3 — or type 'no' if you'd prefer we call you."
                )

                if is_qualified and has_insurance:
                    ai_msg = (
                        f"Thanks for sharing all of that, {name} — based on what you've "
                        f"told me, this looks like something our team can help you with. "
                        f"Many homeowners in your situation end up recovering significantly "
                        f"more than they expected once their policy is properly reviewed.\n\n"
                        f"I'd love to connect you with one of our claim specialists for a "
                        f"free review — no obligation, just a chance to understand your "
                        f"options.\n\n{appt_menu}"
                    )
                elif is_qualified and not has_insurance:
                    ai_msg = (
                        f"{name}, even without your insurance details on hand, your "
                        f"situation still looks like something we can help with. We've "
                        f"guided many homeowners through exactly this — and we can often "
                        f"locate your policy details on our end.\n\n"
                        f"Would you like a free consultation to explore your options?\n\n"
                        f"{appt_menu}"
                    )
                else:
                    ai_msg = (
                        f"Thank you for walking through all of that with me, {name}. "
                        f"I want to be upfront — there may be some factors that could "
                        f"affect your claim: {reason}\n\n"
                        f"That said, every situation is different. We'd still love to "
                        f"have one of our specialists take a closer look — it's completely "
                        f"free and there's no obligation.\n\n{appt_menu}"
                    )
                intake.current_step = IntakeStep.APPOINTMENT.value

                intake.conversation_log = _append_to_log(
                    intake.conversation_log, "ai", ai_msg
                )
                session.commit()
                session.refresh(intake)

                return IntakeChatResponse(
                    success=True,
                    session_id=intake.id,
                    ai_message=ai_msg,
                    current_step=intake.current_step,
                    is_complete=False,
                    is_qualified=intake.is_qualified,
                    collected_data=_get_collected_data(intake),
                )

        # ── Handle appointment step ──
        if current_step == IntakeStep.APPOINTMENT:
            appointment_type = None
            choice = user_msg.lower().strip()
            if choice in ("1", "inspection", "in-person"):
                appointment_type = "inspection"
            elif choice in ("2", "zoom"):
                appointment_type = "zoom"
            elif choice in ("3", "teams", "microsoft teams"):
                appointment_type = "teams"

            # Create the lead first
            lead_id = _create_lead_from_intake(session, intake, current_user)
            intake.lead_id = lead_id
            intake.status = "completed"
            intake.current_step = IntakeStep.COMPLETE.value

            # Book appointment if requested
            if appointment_type:
                appt = IntakeAppointment(
                    appointment_type=appointment_type,
                    homeowner_name=intake.homeowner_name,
                    homeowner_email=intake.email,
                    homeowner_phone=intake.phone,
                    property_address=intake.property_address,
                    session_id=intake.id,
                    assigned_to=current_user.id,
                    status="scheduled",
                )
                session.add(appt)

            summary = _build_summary(_get_collected_data(intake))
            appt_note = ""
            if appointment_type:
                appt_note = f"\nAppointment type: {appointment_type.title()} consultation — we'll reach out to confirm a time.\n"

            name = intake.homeowner_name or 'there'
            ai_msg = (
                f"Thanks for sharing all of that, {name} — based on what you've told me, "
                f"this looks like something our team can help you with.\n\n"
                f"{appt_note}"
                f"Here's a summary of your case:\n\n{summary}\n\n"
                f"We'll review everything right away and reach out shortly to go over "
                f"your options. Our goal is to make sure you get the full coverage you're "
                f"entitled to — many homeowners we've worked with have been pleasantly "
                f"surprised by the outcome.\n\n"
                f"Thank you for trusting ACI, {name} — we're in your corner!"
            )

            intake.conversation_log = _append_to_log(
                intake.conversation_log, "ai", ai_msg
            )
            session.commit()
            session.refresh(intake)

            return IntakeChatResponse(
                success=True,
                session_id=intake.id,
                ai_message=ai_msg,
                current_step=IntakeStep.COMPLETE.value,
                is_complete=True,
                is_qualified=intake.is_qualified,
                collected_data=_get_collected_data(intake),
                lead_id=lead_id,
            )

        # ── Normal step progression ──
        if next_step:
            intake.current_step = next_step.value
            next_cfg = STEP_CONFIG.get(next_step, {})
            prompt_template = next_cfg.get("prompt", "")
            ai_msg = prompt_template.format(**_get_collected_data(intake)) if prompt_template else ""
        else:
            ai_msg = "Thank you! Your intake is complete."
            intake.status = "completed"
            intake.current_step = IntakeStep.COMPLETE.value

        intake.conversation_log = _append_to_log(
            intake.conversation_log, "ai", ai_msg
        )
        session.commit()
        session.refresh(intake)

        return IntakeChatResponse(
            success=True,
            session_id=intake.id,
            ai_message=ai_msg,
            current_step=intake.current_step,
            is_complete=intake.current_step == IntakeStep.COMPLETE.value,
            is_qualified=intake.is_qualified,
            collected_data=_get_collected_data(intake),
            lead_id=intake.lead_id,
        )


def _create_lead_from_intake(session: Session, intake: IntakeSession, current_user) -> UUID | None:
    """Create a Lead + LeadContact from completed intake data."""
    from app.models.lead import Lead
    from app.models.lead_contact import LeadContact

    # Generate next ref_number
    max_ref = session.execute(select(func.max(Lead.ref_number))).scalar() or 0

    lead = Lead(
        ref_number=max_ref + 1,
        loss_date=intake.date_of_loss,
        peril=intake.incident_type,
        insurance_company=intake.insurance_company,
        policy_number=intake.policy_number if intake.policy_number and intake.policy_number.lower() != "skip" else None,
        status="interested",
        source=current_user.id,
        assigned_to=current_user.id,
        source_info="AI Intake Assistant",
        instructions_or_notes=f"Auto-created by AI Intake Assistant. Qualification score: {intake.qualification_score or 0}. Reason: {intake.qualification_reason or 'N/A'}",
        created_by_id=current_user.id,
    )
    session.add(lead)
    session.flush()

    # Parse address into components if possible
    address_parts = (intake.property_address or "").split(",")
    address = address_parts[0].strip() if len(address_parts) > 0 else intake.property_address
    city = address_parts[1].strip() if len(address_parts) > 1 else None
    state = address_parts[2].strip() if len(address_parts) > 2 else None
    zip_code = address_parts[3].strip() if len(address_parts) > 3 else None

    contact = LeadContact(
        lead_id=lead.id,
        full_name=intake.homeowner_name,
        email=intake.email,
        phone_number=intake.phone,
        address=address,
        city=city,
        state=state,
        zip_code=zip_code,
        address_loss=address,
        city_loss=city,
        state_loss=state,
        zip_code_loss=zip_code,
    )
    session.add(contact)
    session.flush()

    return lead.id


# ─────────────────────────────────────────────────────────────
# Session CRUD Endpoints
# ─────────────────────────────────────────────────────────────

@router.get(
    "/sessions",
    summary="List all intake sessions",
    response_model=list[schemas.intake_session.IntakeSession],
)
def list_sessions(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> Any:
    """List intake sessions for the current user."""
    with db_session as session:
        stmt = select(IntakeSession).where(
            IntakeSession.is_removed == False  # noqa: E712
        ).order_by(IntakeSession.created_at.desc())

        if status_filter:
            stmt = stmt.where(IntakeSession.status == status_filter)

        stmt = stmt.offset(offset).limit(limit)
        results = session.execute(stmt).scalars().all()
        return results


@router.get(
    "/sessions/{session_id}",
    summary="Get a single intake session",
    response_model=schemas.intake_session.IntakeSession,
)
def get_session(
    *,
    session_id: Annotated[UUID, Path(description="Intake session ID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single intake session by ID."""
    with db_session as session:
        intake = session.get(IntakeSession, session_id)
        if not intake:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Intake session not found.")
        return intake


# ─────────────────────────────────────────────────────────────
# Appointment Endpoints
# ─────────────────────────────────────────────────────────────

@router.get(
    "/appointments",
    summary="List intake appointments",
    response_model=list[IntakeAppointmentSchema],
)
def list_appointments(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> Any:
    """List appointments booked through AI intake."""
    with db_session as session:
        stmt = select(IntakeAppointment).where(
            IntakeAppointment.is_removed == False  # noqa: E712
        ).order_by(IntakeAppointment.created_at.desc())

        if status_filter:
            stmt = stmt.where(IntakeAppointment.status == status_filter)

        stmt = stmt.offset(offset).limit(limit)
        return session.execute(stmt).scalars().all()


@router.patch(
    "/appointments/{appointment_id}",
    summary="Update an intake appointment",
    response_model=IntakeAppointmentSchema,
)
def update_appointment(
    *,
    appointment_id: Annotated[UUID, Path(description="Appointment ID")],
    body: schemas.intake_appointment.IntakeAppointmentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update appointment status, time, or assignment."""
    with db_session as session:
        appt = session.get(IntakeAppointment, appointment_id)
        if not appt:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Appointment not found.")

        update_data = body.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(appt, field, value)

        session.commit()
        session.refresh(appt)
        return appt


# ─────────────────────────────────────────────────────────────
# Dashboard Metrics
# ─────────────────────────────────────────────────────────────

@router.get(
    "/metrics",
    summary="AI Intake dashboard metrics",
    response_model=IntakeDashboardMetrics,
)
def get_metrics(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return aggregate metrics for the AI Intake dashboard."""
    with db_session as session:
        base = select(IntakeSession).where(IntakeSession.is_removed == False)  # noqa: E712

        conversations_started = session.execute(
            select(func.count(IntakeSession.id)).where(IntakeSession.is_removed == False)  # noqa: E712
        ).scalar() or 0

        completed_intakes = session.execute(
            select(func.count(IntakeSession.id)).where(
                and_(
                    IntakeSession.is_removed == False,  # noqa: E712
                    IntakeSession.status == "completed",
                )
            )
        ).scalar() or 0

        appointments_booked = session.execute(
            select(func.count(IntakeAppointment.id)).where(
                IntakeAppointment.is_removed == False  # noqa: E712
            )
        ).scalar() or 0

        # Clients signed = sessions that resulted in a lead with status "signed" or "interested"
        clients_signed = session.execute(
            select(func.count(IntakeSession.id)).where(
                and_(
                    IntakeSession.is_removed == False,  # noqa: E712
                    IntakeSession.lead_id.isnot(None),
                    IntakeSession.is_qualified == True,  # noqa: E712
                )
            )
        ).scalar() or 0

        # Qualification rate
        qualified_count = session.execute(
            select(func.count(IntakeSession.id)).where(
                and_(
                    IntakeSession.is_removed == False,  # noqa: E712
                    IntakeSession.is_qualified == True,  # noqa: E712
                )
            )
        ).scalar() or 0

        qual_rate = (qualified_count / conversations_started * 100) if conversations_started > 0 else 0.0

        avg_score = session.execute(
            select(func.avg(IntakeSession.qualification_score)).where(
                and_(
                    IntakeSession.is_removed == False,  # noqa: E712
                    IntakeSession.qualification_score.isnot(None),
                )
            )
        ).scalar() or 0.0

        return IntakeDashboardMetrics(
            conversations_started=conversations_started,
            completed_intakes=completed_intakes,
            appointments_booked=appointments_booked,
            clients_signed=clients_signed,
            qualification_rate=round(qual_rate, 1),
            avg_qualification_score=round(float(avg_score), 1),
        )


# ─────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────

@router.get("/health", summary="AI Intake health check")
def health_check(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict:
    """Quick health check — verifies DB connectivity."""
    try:
        with db_session as session:
            session.execute(select(func.count(IntakeSession.id)))
        return {"status": "ok", "service": "ai-intake"}
    except Exception as exc:
        logger.error("AI Intake health check failed: %s", exc)
        return {"status": "degraded", "service": "ai-intake", "error": str(exc)[:100]}


# ─────────────────────────────────────────────────────────────
# Auto-Assignment for High-Priority Leads
# ─────────────────────────────────────────────────────────────

@router.post(
    "/auto-assign",
    summary="Auto-assign a high-priority lead to the best available agent",
)
def auto_assign_lead(
    *,
    body: dict,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> dict:
    """
    Auto-assign a lead based on territory, eligibility, and round-robin.
    Called when lead status becomes BOOKED, CALL_BACK_REQUESTED, or QUALIFIED.
    """
    from app.models.lead import Lead
    from app.models.lead_contact import LeadContact

    lead_id = body.get("lead_id")
    status = body.get("status", "CALL_BACK_REQUESTED")
    session_id = body.get("session_id")

    if not lead_id:
        return {"assigned": False, "reason": "no lead_id provided"}

    try:
        with db_session as session:
            lead = session.get(Lead, lead_id)
            if not lead:
                logger.warning("Auto-assign: lead not found id=%s", lead_id)
                return {"assigned": False, "reason": "lead not found"}

            # Already assigned?
            if lead.assigned_to:
                logger.info("Auto-assign: lead %s already assigned to %s", lead_id, lead.assigned_to)
                return {
                    "assigned": True,
                    "agent_id": str(lead.assigned_to),
                    "reason": "already_assigned",
                }

            # Get contact for territory matching
            contact = session.execute(
                select(LeadContact).where(LeadContact.lead_id == lead.id)
            ).scalar_one_or_none()

            state = contact.state_loss if contact else None
            lead_type = lead.peril or "storm"

            # Try territory-based distribution
            from app.services.claim_zone_lead_pipeline import ClaimZoneLeadPipelineService
            from app.services.lead_distribution_service import distribute_lead

            pipeline_svc = ClaimZoneLeadPipelineService(session)
            territory = pipeline_svc._find_territory(
                contact.city_loss or "" if contact else "",
                state or "",
                lead_type,
            )

            if territory:
                try:
                    result = distribute_lead(
                        session,
                        lead_id=lead.id,
                        territory_id=territory.id,
                        lead_type=lead_type,
                    )
                    agents = result.get("assigned_agents", [])
                    if agents:
                        agent = agents[0]
                        agent_id = agent.get("agent_id") or agent.get("id")
                        agent_name = agent.get("agent_name", "Agent")
                        reason = result.get("assignment_reason", "rotation")

                        logger.info(
                            "Auto-assign: lead=%s → agent=%s territory=%s reason=%s status=%s session=%s",
                            lead_id, agent_name, territory.name, reason, status, session_id,
                        )

                        return {
                            "assigned": True,
                            "agent_id": str(agent_id),
                            "agent_name": agent_name,
                            "territory_name": territory.name or "",
                            "reason": reason,
                            "status": status,
                        }
                except ValueError as exc:
                    logger.warning("Auto-assign: distribution failed for lead %s: %s", lead_id, exc)

            # Fallback: admin review queue
            logger.info("Auto-assign: no eligible agent — lead %s sent to admin review queue", lead_id)
            return {
                "assigned": False,
                "reason": "admin_review_queue",
                "status": status,
                "message": "No eligible agent found — lead added to admin review queue",
            }

    except Exception as exc:
        logger.error("Auto-assign failed for lead %s: %s", lead_id, exc)
        return {"assigned": False, "reason": f"error: {str(exc)[:100]}"}
