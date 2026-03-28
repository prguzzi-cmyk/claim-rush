#!/usr/bin/env python

"""
Celery tasks for AI contact initiation and escalation timeout checking.

Flow:
  1. initiate_ai_contact — called after lead assignment; creates tracker,
     initiates AI call, notifies agent, schedules escalation timeout.
  2. check_escalation_timeout — fired after ESCALATION_TIMEOUT_SECONDS;
     if unresolved, advances escalation and re-schedules.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.lead import Lead
from app.models.user import User
from app.tasks.lead_delivery import _get_agent_phone

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.ai_contact.initiate_ai_contact",
)
def initiate_ai_contact(
    self,
    lead_id: str,
    agent_id: str,
    territory_id: str,
    lead_type: str,
):
    """
    Entry point after lead assignment. Creates escalation tracker,
    initiates AI outbound call, notifies the assigned agent, and
    schedules the first escalation timeout check.
    """
    task_id = self.request.id
    logger.info(
        "[Task:%s] Initiating AI contact for lead %s (agent=%s, territory=%s)",
        task_id, lead_id, agent_id, territory_id,
    )

    db = SessionLocal()
    try:
        from app.services.escalation_service import EscalationService

        svc = EscalationService(db)

        # Create tracker
        tracker = svc.create_tracker(
            lead_id=UUID(lead_id),
            territory_id=UUID(territory_id),
            lead_type=lead_type,
            initial_agent_id=UUID(agent_id),
        )

        # Check quiet hours
        if svc.is_quiet_hours():
            tracker.contact_status = "queued_quiet_hours"
            db.commit()
            next_window = svc.next_send_window()
            logger.info(
                "[Task:%s] Quiet hours — rescheduling for %s", task_id, next_window,
            )
            initiate_ai_contact.apply_async(
                args=[lead_id, agent_id, territory_id, lead_type],
                eta=next_window,
            )
            return

        # Get lead's phone number
        lead = db.get(Lead, lead_id)
        contact_phone = None
        if lead and lead.contact:
            contact_phone = lead.contact.phone_number

        # Initiate AI outbound call
        from app.utils.voice import get_voice_provider

        voice = get_voice_provider()
        if voice and contact_phone and contact_phone not in ("N/A", "", None):
            lead_context = {
                "lead_name": lead.contact.full_name if lead.contact else "Sir or Ma'am",
                "loss_address": lead.contact.address_loss if lead.contact else "",
                "incident_type": lead_type,
            }
            result = voice.initiate_outbound_call(
                to_phone=contact_phone, lead_context=lead_context,
            )
            if result.success:
                tracker.ai_call_status = "initiated"
                tracker.ai_call_sid = result.call_id
                tracker.ai_call_started_at = datetime.now(timezone.utc)
                tracker.contact_status = "ai_call_initiated"
                logger.info(
                    "[Task:%s] AI call initiated: call_id=%s", task_id, result.call_id,
                )
            else:
                tracker.ai_call_status = "failed"
                tracker.contact_status = "sms_sent"
                logger.error(
                    "[Task:%s] AI call failed: %s", task_id, result.error,
                )
        else:
            tracker.ai_call_status = "skipped"
            tracker.contact_status = "sms_sent"
            logger.info(
                "[Task:%s] AI call skipped (voice=%s, phone=%s)",
                task_id, bool(voice), contact_phone,
            )

        db.commit()

        # Send SMS/email/in-app notification to the assigned agent
        celery_app.send_task(
            "app.tasks.lead_delivery.deliver_lead_assignment",
            args=[lead_id, agent_id, territory_id, lead_type],
        )

        # Schedule escalation timeout check
        check_escalation_timeout.apply_async(
            args=[str(tracker.id)],
            countdown=settings.ESCALATION_TIMEOUT_SECONDS,
        )

        logger.info(
            "[Task:%s] AI contact initiated for lead %s, escalation timeout in %ds",
            task_id, lead_id, settings.ESCALATION_TIMEOUT_SECONDS,
        )

    except Exception as exc:
        db.rollback()
        logger.error("[Task:%s] initiate_ai_contact failed: %s", task_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    bind=True,
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.ai_contact.check_escalation_timeout",
)
def check_escalation_timeout(self, tracker_id: str):
    """
    Fired after ESCALATION_TIMEOUT_SECONDS. Checks if the lead contact
    has been resolved. If not, escalates to the next level.
    """
    task_id = self.request.id
    logger.info("[Task:%s] Checking escalation timeout for tracker %s", task_id, tracker_id)

    db = SessionLocal()
    try:
        from app.models.lead_contact_tracker import LeadContactTracker
        from app.services.escalation_service import EscalationService

        tracker = db.get(LeadContactTracker, tracker_id)
        if not tracker:
            logger.warning("[Task:%s] Tracker %s not found", task_id, tracker_id)
            return

        if tracker.is_resolved:
            logger.info(
                "[Task:%s] Tracker %s already resolved (%s), skipping",
                task_id, tracker_id, tracker.resolution_type,
            )
            return

        svc = EscalationService(db)
        advanced = svc.advance_escalation(UUID(tracker_id))

        if not advanced:
            svc.mark_resolved(UUID(tracker_id), "exhausted")
            logger.info("[Task:%s] Tracker %s exhausted all levels", task_id, tracker_id)
            return

        # Reload tracker to get updated current_agent_id
        db.refresh(tracker)

        # If escalated to chapter president (level 4), add extra escalation notification
        if tracker.current_escalation_level == 4:
            from app.utils.notifications import create_notification

            create_notification(
                db,
                user_id=tracker.current_agent_id,
                title="Lead Escalated to You",
                message=(
                    "A lead has been escalated to you as Chapter President. "
                    "Previous agents did not respond within the timeout period."
                ),
                notification_type="escalation",
                link=f"/#/app/leads/{tracker.lead_id}",
                lead_id=tracker.lead_id,
            )
            db.commit()

        # Send notification to new agent
        celery_app.send_task(
            "app.tasks.lead_delivery.deliver_lead_assignment",
            args=[
                str(tracker.lead_id),
                str(tracker.current_agent_id),
                str(tracker.territory_id),
                tracker.lead_type,
            ],
        )

        # Attempt transfer if AI call is still active
        from app.utils.voice import get_voice_provider

        voice = get_voice_provider()
        if voice and tracker.ai_call_sid:
            agent = db.get(User, tracker.current_agent_id)
            agent_phone = _get_agent_phone(agent) if agent else None
            if agent_phone:
                agent_name = f"{agent.first_name} {agent.last_name}"
                transfer_result = voice.transfer_call(
                    call_id=tracker.ai_call_sid,
                    to_phone=agent_phone,
                    agent_name=agent_name,
                )
                # Update latest escalation attempt
                from app.models.escalation_attempt import EscalationAttempt
                from sqlalchemy import select

                latest_stmt = (
                    select(EscalationAttempt)
                    .where(EscalationAttempt.tracker_id == UUID(tracker_id))
                    .order_by(EscalationAttempt.escalation_level.desc())
                    .limit(1)
                )
                latest = db.execute(latest_stmt).scalar_one_or_none()
                if latest:
                    latest.transfer_status = "initiated" if transfer_result.success else "failed"
                    latest.transfer_attempted_at = datetime.now(timezone.utc)
                    if transfer_result.success:
                        latest.transfer_call_sid = transfer_result.call_id
                    db.commit()

        # Schedule next timeout
        check_escalation_timeout.apply_async(
            args=[tracker_id],
            countdown=settings.ESCALATION_TIMEOUT_SECONDS,
        )

        logger.info(
            "[Task:%s] Tracker %s escalated to level %d, next check in %ds",
            task_id, tracker_id, tracker.current_escalation_level,
            settings.ESCALATION_TIMEOUT_SECONDS,
        )

    except Exception as exc:
        db.rollback()
        logger.error("[Task:%s] check_escalation_timeout failed: %s", task_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
