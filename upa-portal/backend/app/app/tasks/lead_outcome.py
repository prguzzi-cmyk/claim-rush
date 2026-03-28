#!/usr/bin/env python

"""Celery task for sending brochure email after 'wants-more-information' outcome."""

import logging
from pathlib import Path

from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.communication_log import CommunicationLog
from app.utils.emails import send_email

logger = logging.getLogger(__name__)

BROCHURE_PATH = Path(__file__).resolve().parent.parent / "static" / "brochures" / "company_brochure.pdf"

TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "email-templates" / "build" / "brochure_email.html"
)


@celery_app.task(
    bind=True,
    name="app.tasks.lead_outcome.send_brochure_email",
    max_retries=3,
    retry_backoff=True,
)
def send_brochure_email(self, email_to: str, contact_name: str, lead_id: str | None = None) -> dict:
    """Send brochure PDF via email to the lead contact."""

    logger.info("Sending brochure email to %s (%s)", email_to, contact_name)

    # Load HTML template
    if TEMPLATE_PATH.exists():
        html_body = TEMPLATE_PATH.read_text()
        html_body = html_body.replace("{{ contact_name }}", contact_name or "there")
        html_body = html_body.replace("{{ project_name }}", settings.PROJECT_NAME)
    else:
        html_body = (
            f"<p>Hi {contact_name or 'there'},</p>"
            f"<p>Thank you for your interest! Please find our company brochure attached.</p>"
            f"<p>Warm regards,<br>The {settings.PROJECT_NAME} Team</p>"
        )

    # Load PDF attachment if available
    attachments = None
    if BROCHURE_PATH.exists():
        pdf_bytes = BROCHURE_PATH.read_bytes()
        attachments = [(pdf_bytes, "company_brochure.pdf")]
    else:
        logger.warning("Brochure PDF not found at %s — sending email without attachment", BROCHURE_PATH)

    # Create CommunicationLog
    db = SessionLocal()
    comm_log = None
    try:
        comm_log = CommunicationLog(
            lead_id=lead_id,
            channel="email",
            purpose="brochure",
            template_type="brochure_email",
            recipient_email=email_to,
            subject=f"{settings.PROJECT_NAME} — Company Brochure",
            body_preview=f"Hi {contact_name or 'there'}, please find our company brochure attached."[:500],
            send_status="pending",
        )
        db.add(comm_log)
        db.flush()

        msg_id = send_email(
            to=email_to,
            subject=f"{settings.PROJECT_NAME} — Company Brochure",
            body_html=html_body,
            body_plain=f"Hi {contact_name or 'there'}, please find our company brochure attached.",
            attachments=attachments,
            communication_log_id=str(comm_log.id),
        )

        now = datetime.now(timezone.utc)
        comm_log.send_status = "delivered"
        comm_log.sent_at = now
        comm_log.delivered_at = now
        comm_log.provider_message_id = msg_id
        db.commit()

        logger.info("Brochure email sent to %s", email_to)
        return {"status": "success", "recipient": email_to}
    except Exception as exc:
        if comm_log:
            try:
                comm_log.send_status = "failed"
                comm_log.failure_reason = str(exc)[:1000]
                db.commit()
            except Exception:
                db.rollback()
        logger.error("Failed to send brochure email to %s: %s", email_to, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()
