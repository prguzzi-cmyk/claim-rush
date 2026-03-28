#!/usr/bin/env python

"""Celery task for converting crime incidents into rotation leads."""

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.services.crime_lead_rotation_service import CrimeLeadRotationService


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.crime_lead_rotation.process_crime_leads",
)
def process_crime_leads(self, lookback_hours: int = 24) -> str:
    """
    Process recent crime incidents and auto-convert eligible ones
    into rotation leads with round-robin assignment.
    """
    celery_log.info("Starting crime lead rotation processing (lookback=%dh)", lookback_hours)

    db_session = SessionLocal()
    try:
        service = CrimeLeadRotationService(db_session)
        count = service.process_recent_incidents(lookback_hours=lookback_hours)

        summary = f"Crime lead rotation: {count} leads created."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error("Crime lead rotation task failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db_session.close()
