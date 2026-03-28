#!/usr/bin/env python

from celery.exceptions import MaxRetriesExceededError
from celery.schedules import crontab
from celery import states
from celery.utils.log import get_task_logger

from app.core.config import settings
from app.core.celery_app import celery_app
from app.models import Claim
from app.tasks import (
    create_business_email,
    daily_schedule,
    send_business_email_error,
    task_new_lead_account_email,
)
from app.utils.emails import send_email

import app.tasks.pulsepoint  # noqa — registers poll_pulsepoint_agencies task
import app.tasks.lead_delivery  # noqa — registers deliver_lead_assignment task
import app.tasks.lead_outcome  # noqa — registers send_brochure_email task
import app.tasks.communication  # noqa — registers send_tracked_email_task + flush_quiet_hours_queue
import app.tasks.ai_contact  # noqa — registers initiate_ai_contact + check_escalation_timeout
import app.tasks.roof_analysis  # noqa — registers process_roof_batch task
import app.tasks.spc  # noqa — registers poll_spc_storm_reports task
import app.tasks.nws  # noqa — registers poll_nws_storm_alerts task
import app.tasks.storm_pipeline  # noqa — registers trigger_roof_analysis_pipeline task
import app.tasks.property_ingestion  # noqa — registers property ingestion tasks
import app.tasks.storm_lead_rotation  # noqa — registers process_storm_claim_zones task
import app.tasks.claim_zone_lead_pipeline  # noqa — registers claim zone lead pipeline tasks
import app.tasks.crime_ingestion  # noqa — registers poll_crime_sources task
import app.tasks.crime_lead_rotation  # noqa — registers process_crime_leads task
import app.tasks.skip_trace  # noqa — registers run_skiptrace_for_lead task
import app.tasks.rotation_lead  # noqa — registers rotation lead timeout tasks
import app.tasks.outreach  # noqa — registers execute_outreach_task
import app.tasks.voice_campaign  # noqa — registers process_voice_campaign_calls + process_single_campaign_call
import app.tasks.inspection_scheduling  # noqa — registers send_inspection_reminder task
import app.tasks.client_portal_follow_up  # noqa — registers process_client_portal_follow_ups task

logger = get_task_logger(__name__)


@celery_app.task(acks_late=True)
def test_celery(word: str) -> str:
    return f"Test task return {word}"


@celery_app.task(acks_late=True)
def new_lead_account_email(user_entity, password):
    task_new_lead_account_email(user_entity, password)


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(
        crontab(minute="0", hour="0"), daily_schedule.s(), name="daily-schedule"
    )
    sender.add_periodic_task(
        crontab(minute="0", hour="*/1"),
        app.tasks.rotation_lead.check_rotation_lead_timeouts.s(),
        name="rotation-lead-timeout-check",
    )
    sender.add_periodic_task(
        crontab(minute="30", hour="*/2"),
        app.tasks.crime_lead_rotation.process_crime_leads.s(),
        name="crime-lead-rotation",
    )


@celery_app.task(
    bind=True,
    max_retries=3,
    on_failure=lambda self, exc, task_id, args, kwargs, einfo: business_email_failure(
        self, exc, task_id, args, kwargs, einfo
    ),
)
def execute_business_email_creation_task(self, obj_in: Claim, **kwargs) -> str:
    try:
        return create_business_email(obj_in)
    except Exception as exc:
        raise self.retry(
            countdown=1**self.request.retries, kwargs={"exc_msg": str(exc)}
        )


def business_email_failure(self, exc, task_id, args, kwargs, einfo):
    # Task failure after all retries
    if isinstance(exc, MaxRetriesExceededError):
        print("Business Email creation task failed after maximum retries.")

        # Send error notification to an administrator
        send_business_email_error(obj_in=args[0], error_msg=kwargs["exc_msg"])

        print("Business Email error notification sent.")
    else:
        print("Task failed due to unexpected error:", exc)


@celery_app.task(
    bind=True,
    queue="main-queue",
    serializer="json",
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    track_started=True,
    name="tasks.send_ai_estimate_email",
)
def send_ai_estimate_email(
    self, to: str, subject: str, body_html: str, body_plain: str
) -> None:
    """Send AI estimate email with enhanced error handling and status tracking"""
    task_id = self.request.id
    logger.info(f"[Task:{task_id}] Starting email task for recipient {to}")
    logger.info(
        f"[Task:{task_id}] Queue: {self.request.delivery_info.get('routing_key', 'unknown')}"
    )
    logger.info(
        f"[Task:{task_id}] Retry count: {self.request.retries}/{self.max_retries}"
    )

    logger.info(
        f"[Task:{task_id}] SMTP Settings - "
        f"Host: {settings.SMTP_HOST}, "
        f"Port: {settings.SMTP_PORT}, "
        f"User: {settings.SMTP_USER}, "
        f"TLS: {settings.SMTP_TLS}, "
        f"Enabled: {settings.EMAILS_ENABLED}"
    )

    try:
        self.update_state(state=states.STARTED)
        logger.info(f"[Task:{task_id}] Attempting to send email...")

        send_email(
            to=to,
            subject=subject,
            body_html=body_html,
            body_plain=body_plain,
        )

        logger.info(f"[Task:{task_id}] Email sent successfully to {to}")
        self.update_state(state=states.SUCCESS)
        return {"status": "success", "recipient": to}

    except Exception as exc:
        logger.error(
            f"[Task:{task_id}] Failed to send email to {to}: {str(exc)}", exc_info=True
        )
        logger.error(f"[Task:{task_id}] Exception type: {type(exc)}")

        try:
            self.update_state(
                state=states.RETRY,
                meta={
                    "exc_type": type(exc).__name__,
                    "exc_message": str(exc),
                    "current_retry": self.request.retries,
                    "max_retries": self.max_retries,
                },
            )
            raise self.retry(exc=exc)

        except MaxRetriesExceededError:
            logger.error(
                f"[Task:{task_id}] Max retries exceeded for sending email to {to}"
            )
            self.update_state(
                state=states.FAILURE,
                meta={
                    "exc_type": type(exc).__name__,
                    "exc_message": str(exc),
                    "final_retry": self.request.retries,
                },
            )
            raise
