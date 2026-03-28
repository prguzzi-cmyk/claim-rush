#!/usr/bin/env python

"""Celery tasks for the lead rotation engine timeout checks."""

from uuid import UUID

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.services.rotation_lead_service import RotationLeadService


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.rotation_lead.check_rotation_lead_timeouts",
)
def check_rotation_lead_timeouts(self) -> str:
    """Periodic task (hourly): check all assigned leads for timeout and reassign."""
    celery_log.info("Starting rotation lead timeout check")

    db_session = SessionLocal()
    try:
        service = RotationLeadService(db_session)
        count = service.check_timeout_reassignments()
        summary = f"Rotation lead timeout check complete: {count} lead(s) reassigned."
        celery_log.info(summary)
        return summary
    except Exception as exc:
        celery_log.error("Rotation lead timeout check failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db_session.close()


@celery_app.task(
    bind=True,
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=120,
    name="app.tasks.rotation_lead.check_single_lead_timeout",
)
def check_single_lead_timeout(self, lead_id: str) -> str:
    """Delayed task scheduled after each assignment to check a specific lead."""
    celery_log.info("Checking timeout for rotation lead %s", lead_id)

    db_session = SessionLocal()
    try:
        from app import crud

        lead = crud.rotation_lead.get(db_session, obj_id=UUID(lead_id))
        if not lead:
            return f"Lead {lead_id} not found, skipping."

        # Only reassign if still assigned with 0 contact attempts
        if lead.lead_status == "assigned" and lead.contact_attempt_count == 0:
            service = RotationLeadService(db_session)
            service.reassign_lead(
                lead_id=lead.id,
                new_agent_id=None,
                reason="Scheduled timeout — no contact attempt",
                user_id=lead.assigned_agent_id,
            )
            return f"Lead {lead_id} reassigned due to timeout."

        return f"Lead {lead_id} already contacted or status changed, no action."
    except Exception as exc:
        celery_log.error("Single lead timeout check failed for %s: %s", lead_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db_session.close()
