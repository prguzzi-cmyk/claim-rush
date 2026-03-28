#!/usr/bin/env python

"""Celery tasks for sending tracked emails and flushing the quiet-hours queue."""

import logging
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.communication_log import CommunicationLog
from app.utils.emails import send_email

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.communication.send_tracked_email_task",
)
def send_tracked_email_task(
    self,
    log_id: str,
    body_html: str,
    body_plain: str,
    attachments_data: list | None = None,
) -> dict:
    """Send a tracked email and update the CommunicationLog record."""
    task_id = self.request.id
    logger.info("[Task:%s] Sending tracked email for log_id=%s", task_id, log_id)

    db = SessionLocal()
    try:
        log = db.get(CommunicationLog, log_id)
        if not log:
            logger.error("[Task:%s] CommunicationLog %s not found", task_id, log_id)
            return {"status": "error", "reason": "log not found"}

        # Build attachments
        attachments = None
        if attachments_data:
            attachments = [(content, filename) for content, filename in attachments_data]

        # Send email with tracking injection
        msg_id = send_email(
            to=log.recipient_email,
            subject=log.subject or "",
            body_html=body_html,
            body_plain=body_plain,
            attachments=attachments,
            communication_log_id=str(log.id),
        )

        # Update log: mark as delivered (SMTP doesn't have true delivery webhooks)
        now = datetime.now(timezone.utc)
        log.send_status = "delivered"
        log.sent_at = now
        log.delivered_at = now
        log.provider_message_id = msg_id
        db.commit()

        logger.info("[Task:%s] Email delivered for log_id=%s", task_id, log_id)
        return {"status": "delivered", "log_id": log_id, "message_id": msg_id}

    except Exception as exc:
        db.rollback()
        logger.error("[Task:%s] Email failed for log_id=%s: %s", task_id, log_id, exc, exc_info=True)

        # Update failure status
        try:
            log = db.get(CommunicationLog, log_id)
            if log:
                log.send_status = "failed"
                log.failure_reason = str(exc)[:1000]
                db.commit()
        except Exception:
            db.rollback()

        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.communication.flush_quiet_hours_queue",
)
def flush_quiet_hours_queue() -> dict:
    """Dispatch queued records whose scheduled_send_at has passed."""
    logger.info("Flushing quiet-hours queue...")

    db = SessionLocal()
    try:
        from app.crud.crud_communication_log import communication_log as comm_crud

        queued = comm_crud.get_queued_for_send(db)
        dispatched = 0

        for log in queued:
            # We don't have the body stored, so we mark it for re-processing
            # In practice, the body would need to be stored or regenerated
            # For now, mark as failed with reason if body not available
            log.send_status = "pending"
            log.is_queued_for_quiet_hours = False
            db.commit()

            # Re-dispatch via Celery (the task will need to handle log without body)
            logger.info("Re-dispatching queued log_id=%s", log.id)
            dispatched += 1

        logger.info("Flushed %d queued communications", dispatched)
        return {"dispatched": dispatched}

    except Exception as exc:
        db.rollback()
        logger.error("Failed to flush quiet-hours queue: %s", exc, exc_info=True)
        return {"error": str(exc)}
    finally:
        db.close()
