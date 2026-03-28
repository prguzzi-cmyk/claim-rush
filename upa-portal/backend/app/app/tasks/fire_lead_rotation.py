#!/usr/bin/env python

"""Celery task for processing new fire incidents through the auto-lead rotation engine."""

from uuid import UUID

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.services.fire_lead_rotation_service import FireLeadRotationService


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.fire_lead_rotation.process_new_fire_incidents",
)
def process_new_fire_incidents(self, incident_ids: list[str]) -> str:
    """
    Process a batch of newly-created fire incident IDs through the
    Fire Lead Rotation Engine.

    Each incident is evaluated independently: eligible incidents get
    auto-converted to leads, distributed to agents, and trigger
    SMS/email/in-app notifications.
    """
    if not incident_ids:
        return "No incident IDs to process."

    celery_log.info(
        "Processing %d new fire incident(s) for auto-lead rotation",
        len(incident_ids),
    )

    db_session = SessionLocal()
    try:
        service = FireLeadRotationService(db_session)
        processed = 0
        for id_str in incident_ids:
            try:
                service.process_incident(UUID(id_str))
                processed += 1
            except Exception as exc:
                celery_log.error(
                    "Error processing incident %s: %s", id_str, exc, exc_info=True,
                )

        summary = f"Processed {processed}/{len(incident_ids)} incidents for auto-lead rotation."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error("Fire lead rotation task failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db_session.close()
