#!/usr/bin/env python

"""Celery tasks for the Inspection Scheduling module"""

import logging
from uuid import UUID

from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=120,
    name="app.tasks.inspection_scheduling.send_inspection_reminder",
)
def send_inspection_reminder(
    self, inspection_id: str, target: str, channel: str
) -> dict:
    """
    Send an inspection reminder via SMS or email.

    Parameters
    ----------
    inspection_id : str
        UUID of the inspection record
    target : str
        'homeowner' or 'adjuster'
    channel : str
        'sms' or 'email'
    """
    db = SessionLocal()
    try:
        from app.models.inspection_schedule import InspectionSchedule
        from app.models.in_app_notification import InAppNotification

        inspection = db.query(InspectionSchedule).filter(
            InspectionSchedule.id == UUID(inspection_id)
        ).first()

        if not inspection:
            logger.warning(f"Inspection {inspection_id} not found, skipping reminder.")
            return {"status": "skipped", "reason": "not_found"}

        # Build reminder message
        if target == "homeowner":
            name = inspection.homeowner_name
            message = (
                f"Hi {name}, reminder: your property inspection at "
                f"{inspection.property_address} is scheduled for "
                f"{inspection.inspection_date} at {inspection.inspection_time}."
            )
            recipient_phone = inspection.homeowner_phone
            recipient_email = inspection.homeowner_email
        else:
            message = (
                f"Reminder: inspection at {inspection.property_address} "
                f"({inspection.homeowner_name}) on {inspection.inspection_date} "
                f"at {inspection.inspection_time}."
            )
            recipient_phone = None
            recipient_email = None

        # Dispatch via channel
        dispatch_status = "sent"
        if channel == "sms" and recipient_phone:
            try:
                from app.utils.sms.twilio_provider import TwilioProvider
                sms = TwilioProvider()
                sms.send_sms(to=recipient_phone, body=message)
            except Exception as e:
                logger.error(f"SMS send failed: {e}")
                dispatch_status = "sms_failed"
        elif channel == "email" and recipient_email:
            try:
                from app.utils.emails import send_email
                send_email(
                    to=recipient_email,
                    subject="Inspection Reminder",
                    body_html=f"<p>{message}</p>",
                    body_plain=message,
                )
            except Exception as e:
                logger.error(f"Email send failed: {e}")
                dispatch_status = "email_failed"
        else:
            dispatch_status = "no_contact_info"

        # Increment reminders_sent
        inspection.reminders_sent = (inspection.reminders_sent or 0) + 1
        db.commit()

        # Create in-app notification for the adjuster
        if inspection.adjuster_id:
            notification = InAppNotification(
                user_id=inspection.adjuster_id,
                title="Inspection Reminder Sent",
                message=message,
                notification_type="inspection_reminder",
                link=f"/app/inspection-calendar",
            )
            db.add(notification)
            db.commit()

        return {"status": dispatch_status, "inspection_id": inspection_id}

    except Exception as exc:
        db.rollback()
        logger.error(f"Reminder task failed for {inspection_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
