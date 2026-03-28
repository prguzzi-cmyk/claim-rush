#!/usr/bin/env python

"""Celery tasks for the outreach engine — dispatches SMS, email, or voice."""

import logging
from uuid import UUID

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=120,
    name="app.tasks.outreach.execute_outreach_task",
)
def execute_outreach_task(self, campaign_id: str, lead_id: str) -> dict:
    """Execute a single outreach attempt for a campaign + lead pair."""
    task_id = self.request.id
    logger.info(
        "[Outreach:%s] Starting for campaign=%s lead=%s", task_id, campaign_id, lead_id
    )

    db = SessionLocal()
    try:
        from app.crud import outreach_campaign, outreach_template, outreach_attempt, conversation_message
        from app.models import Lead, OutreachAttempt as OutreachAttemptModel
        from app.models.lead_contact import LeadContact
        from app.models.lead_skip_trace import LeadSkipTrace
        from app.models.in_app_notification import InAppNotification
        from app.schemas.outreach_attempt import OutreachAttemptCreate
        from app.schemas.conversation_message import ConversationMessageCreate

        # 1. Load campaign + template
        campaign = db.get(
            __import__("app.models", fromlist=["OutreachCampaign"]).OutreachCampaign,
            UUID(campaign_id),
        )
        if not campaign:
            logger.error("[Outreach:%s] Campaign %s not found", task_id, campaign_id)
            return {"status": "error", "reason": "campaign not found"}

        template = db.get(
            __import__("app.models", fromlist=["OutreachTemplate"]).OutreachTemplate,
            campaign.template_id,
        )
        if not template:
            logger.error("[Outreach:%s] Template not found for campaign", task_id)
            return {"status": "error", "reason": "template not found"}

        lead = db.get(Lead, UUID(lead_id))
        if not lead:
            logger.error("[Outreach:%s] Lead %s not found", task_id, lead_id)
            return {"status": "error", "reason": "lead not found"}

        # 2. Check max_attempts
        from sqlalchemy import and_, func, select

        attempt_count = db.scalar(
            select(func.count()).where(
                and_(
                    OutreachAttemptModel.campaign_id == UUID(campaign_id),
                    OutreachAttemptModel.lead_id == UUID(lead_id),
                )
            )
        ) or 0

        if attempt_count >= campaign.max_attempts:
            logger.info(
                "[Outreach:%s] Max attempts (%d) reached for campaign=%s lead=%s",
                task_id, campaign.max_attempts, campaign_id, lead_id,
            )
            return {"status": "skipped", "reason": "max_attempts reached"}

        # 3. Resolve contact info
        contact = db.scalar(
            select(LeadContact).where(LeadContact.lead_id == lead.id)
        )
        skip_trace = db.scalar(
            select(LeadSkipTrace).where(LeadSkipTrace.lead_id == lead.id)
        )

        phone = None
        email = None
        owner_name = "Homeowner"
        property_address = ""

        if contact:
            phone = contact.phone_number
            email = contact.email
            owner_name = contact.full_name or owner_name
            property_address = f"{contact.address or ''} {contact.city or ''} {contact.state or ''} {contact.zip_code or ''}".strip()

        if skip_trace:
            phone = phone or getattr(skip_trace, "phone_1", None)
            email = email or getattr(skip_trace, "email_1", None)
            owner_name = owner_name or getattr(skip_trace, "owner_name", "Homeowner")

        # 4. Render template
        variables = {
            "owner_name": owner_name,
            "property_address": property_address,
            "incident_type": lead.peril or "Incident",
            "adjuster_name": "Your Agent",
        }
        rendered_body = outreach_template.render_template(template.body, variables)

        # 5. Dispatch by channel
        dispatch_status = "sent"
        recipient_phone = None
        recipient_email = None

        channel = campaign.contact_method

        try:
            if channel == "sms" and phone:
                recipient_phone = phone
                if settings.TWILIO_ENABLED:
                    from app.utils.sms.twilio_provider import TwilioSMSProvider

                    provider = TwilioSMSProvider(
                        account_sid=settings.TWILIO_ACCOUNT_SID,
                        auth_token=settings.TWILIO_AUTH_TOKEN,
                        from_number=settings.TWILIO_FROM_NUMBER,
                    )
                    result = provider.send_sms(to=phone, body=rendered_body)
                    dispatch_status = "delivered" if result.success else "failed"
                else:
                    logger.warning("[Outreach:%s] Twilio not enabled, marking as sent", task_id)

            elif channel == "email" and email:
                recipient_email = email
                from app.tasks.communication import send_tracked_email_task
                from app.models.communication_log import CommunicationLog

                log = CommunicationLog(
                    lead_id=lead.id,
                    channel="email",
                    direction="outbound",
                    recipient_email=email,
                    subject=template.subject or "Outreach",
                    send_status="pending",
                )
                db.add(log)
                db.commit()
                db.refresh(log)

                send_tracked_email_task.delay(
                    str(log.id),
                    rendered_body,
                    rendered_body,
                )
                dispatch_status = "sent"

            elif channel == "voice" and phone:
                recipient_phone = phone
                if settings.VAPI_ENABLED:
                    from app.utils.voice.vapi_provider import VapiProvider

                    provider = VapiProvider(
                        api_key=settings.VAPI_API_KEY,
                        assistant_id=settings.VAPI_ASSISTANT_ID,
                        phone_number_id=settings.VAPI_PHONE_NUMBER_ID,
                    )
                    result = provider.initiate_outbound_call(
                        to_phone=phone, lead_context=variables
                    )
                    dispatch_status = "delivered" if result.success else "failed"
                else:
                    logger.warning("[Outreach:%s] VAPI not enabled, marking as sent", task_id)
            else:
                dispatch_status = "failed"
                logger.warning(
                    "[Outreach:%s] No valid contact for channel=%s", task_id, channel
                )
        except Exception as exc:
            dispatch_status = "failed"
            logger.error("[Outreach:%s] Dispatch error: %s", task_id, exc)

        # 6. Create OutreachAttempt record
        attempt = OutreachAttemptModel(
            campaign_id=UUID(campaign_id),
            lead_id=UUID(lead_id),
            template_id=template.id,
            channel=channel,
            status=dispatch_status,
            attempt_number=attempt_count + 1,
            recipient_phone=recipient_phone,
            recipient_email=recipient_email,
            message_body=rendered_body,
            agent_id=lead.assigned_to,
        )
        db.add(attempt)

        # 7. Create ConversationMessage record
        from app.models.conversation_message import ConversationMessage

        msg = ConversationMessage(
            lead_id=UUID(lead_id),
            direction="outbound",
            channel=channel,
            sender_type="system",
            content=rendered_body,
        )
        db.add(msg)

        # 8. Create InAppNotification for assigned agent
        if lead.assigned_to:
            notification = InAppNotification(
                user_id=lead.assigned_to,
                title="Outreach Sent",
                body=f"Outreach ({channel}) sent to lead via campaign '{campaign.name}'",
                category="outreach",
                link=f"/app/outreach/conversations/{lead_id}",
            )
            db.add(notification)

        db.commit()

        logger.info(
            "[Outreach:%s] Completed: channel=%s status=%s attempt=%d",
            task_id, channel, dispatch_status, attempt_count + 1,
        )
        return {
            "status": dispatch_status,
            "attempt_number": attempt_count + 1,
            "channel": channel,
        }

    except Exception as exc:
        db.rollback()
        logger.error("[Outreach:%s] Task failed: %s", task_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
