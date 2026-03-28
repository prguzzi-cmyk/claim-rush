#!/usr/bin/env python

"""
Client Portal Follow-Up Processing Task
=========================================
Celery beat task that scans for due follow-ups and dispatches them
via SMS, email, or voice channels.

Schedule: every 5 minutes (configured in celery_config.py)
"""

import logging

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.services.client_portal_lead_service import ClientPortalLeadService

logger = logging.getLogger(__name__)


@celery_app.task(name="process_client_portal_follow_ups")
def process_client_portal_follow_ups() -> dict:
    """
    Scan for due follow-ups and execute them.
    Called by Celery beat on a recurring schedule.
    """
    db = SessionLocal()
    try:
        svc = ClientPortalLeadService(db)
        due = svc.get_due_follow_ups()

        if not due:
            return {"processed": 0, "sent": 0, "failed": 0}

        results = {"processed": 0, "sent": 0, "failed": 0}

        for fu in due:
            results["processed"] += 1
            try:
                lead = fu.lead

                if fu.channel == "sms" and lead and lead.phone:
                    _dispatch_sms(lead.phone, fu.message_text or "")
                elif fu.channel == "email" and lead and lead.email:
                    _dispatch_email(lead.email, lead.name, fu.message_text or "")
                elif fu.channel == "voice" and lead and lead.phone:
                    _dispatch_voice(lead.phone, lead.name, fu.message_text or "")

                svc.mark_follow_up_sent(fu.id, delivered=True)
                results["sent"] += 1

                # Update lead contact timestamp
                if lead:
                    lead.last_contact_at = fu.sent_at
                    db.commit()

                logger.info(
                    f"Follow-up dispatched: {fu.id} via {fu.channel} "
                    f"to {lead.name if lead else 'unknown'}"
                )

            except Exception as e:
                svc.mark_follow_up_failed(fu.id, str(e))
                results["failed"] += 1
                logger.error(f"Follow-up {fu.id} dispatch failed: {e}")

        logger.info(
            f"Follow-up batch complete: {results['processed']} processed, "
            f"{results['sent']} sent, {results['failed']} failed"
        )
        return results

    finally:
        db.close()


# ── Channel Dispatch (replace with real service calls) ────────────

def _dispatch_sms(phone: str, message: str) -> None:
    """
    Future: Twilio integration
    client = Client(TWILIO_SID, TWILIO_TOKEN)
    client.messages.create(to=phone, from_=TWILIO_NUMBER, body=message)
    """
    logger.info(f"[SMS DISPATCH] {phone}: {message[:100]}")


def _dispatch_email(email: str, name: str, message: str) -> None:
    """
    Future: SendGrid / SES integration
    sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_KEY)
    mail = Mail(from_email=FROM_EMAIL, to_emails=email, subject="Claim Update", plain_text_content=message)
    sg.send(mail)
    """
    logger.info(f"[EMAIL DISPATCH] {email} ({name}): {message[:100]}")


def _dispatch_voice(phone: str, name: str, script: str) -> None:
    """
    Future: Retell AI / Vapi integration
    retell.create_call(to=phone, agent_id=AGENT_ID, metadata={"name": name, "script": script})
    """
    logger.info(f"[VOICE DISPATCH] {phone} ({name}): {script[:100]}")
