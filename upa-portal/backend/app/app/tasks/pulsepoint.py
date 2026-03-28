#!/usr/bin/env python

"""Celery tasks for the PulsePoint fire incident polling.

Architecture
------------
dispatch_pulsepoint_polls (beat, every 2 min)
    → selects ~1,000 least-recently-polled active agencies
    → splits into sub-batches of ~100
    → fans out poll_agency_batch tasks in a celery group

poll_agency_batch (worker, pulsepoint-queue)
    → iterates agency IDs, polls each via _poll_single_agency()
    → 200ms sleep between requests for rate limiting

poll_pulsepoint_agencies (legacy fallback)
    → polls ALL active agencies sequentially (manual trigger only)
"""

import time

from celery import group

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.utils.pulsepoint import fetch_pulsepoint_incidents

# ── Configuration ──
DISPATCH_BATCH_SIZE = 5000   # agencies per beat cycle — poll ALL configured agencies
SUB_BATCH_SIZE = 100         # agencies per worker task
INTER_REQUEST_DELAY = 0.2    # seconds between API calls within a batch


def _poll_single_agency(db_session, agency_id: str, agency_uuid) -> tuple[int, list]:
    """
    Fetch, decrypt, and upsert incidents for a single agency.

    Ingests BOTH active AND recently-closed incidents from PulsePoint so that
    incidents which cleared from dispatch remain visible for the 24h window.

    Returns (count, new_ids) or (-1, []) on failure.
    """
    raw = fetch_pulsepoint_incidents(agency_id)
    if raw is None:
        celery_log.warning(f"[PulsePoint] Failed to fetch data for agency {agency_id}")
        return -1, []

    incidents_data = raw.get("incidents", {})
    active_incidents = incidents_data.get("active", [])
    # Also ingest recently-closed incidents — PulsePoint returns these
    # separately and they represent fires that just cleared dispatch.
    # Without ingesting these, they vanish from our 24h view.
    recent_closed = incidents_data.get("recent", [])

    # Merge both lists for upsert — dedup by ID happens in upsert_from_pulsepoint
    all_incidents = active_incidents + recent_closed

    celery_log.info(
        f"[PulsePoint] Agency {agency_id}: "
        f"active={len(active_incidents)} recent_closed={len(recent_closed)} "
        f"total={len(all_incidents)}"
    )

    count, new_ids = crud.fire_incident.upsert_from_pulsepoint(
        db_session,
        agency_uuid=agency_uuid,
        incidents_list=all_incidents,
    )
    crud.fire_agency.update_last_polled(db_session, agency_uuid=agency_uuid)
    return count, new_ids


# ── Coordinator task (beat schedule) ──

@celery_app.task()
def dispatch_pulsepoint_polls() -> str:
    """
    Coordinator: select the next batch of agencies to poll and fan out
    parallel sub-batch worker tasks.

    Runs on the beat schedule (every 2 minutes).
    """
    db_session = SessionLocal()
    try:
        agencies = crud.fire_agency.get_next_poll_batch(
            db_session, batch_size=DISPATCH_BATCH_SIZE
        )
        if not agencies:
            celery_log.info("[PulsePoint] Dispatch: no active agencies found.")
            return "No active agencies to dispatch."

        # Build list of (agency_id, agency_uuid) tuples
        agency_pairs = [(a.agency_id, str(a.id)) for a in agencies]

        # Log all agencies being polled this cycle
        agency_id_list = [a.agency_id for a in agencies]
        celery_log.info(
            f"[PulsePoint] Dispatch: polling {len(agency_pairs)} agencies: "
            f"{agency_id_list[:20]}{'...' if len(agency_id_list) > 20 else ''}"
        )

        # Split into sub-batches
        sub_batches = [
            agency_pairs[i : i + SUB_BATCH_SIZE]
            for i in range(0, len(agency_pairs), SUB_BATCH_SIZE)
        ]

        # Fan out as a celery group
        job = group(
            poll_agency_batch.s(batch) for batch in sub_batches
        )
        job.apply_async(queue="pulsepoint-queue")

        summary = (
            f"[PulsePoint] Dispatched {len(sub_batches)} sub-batches "
            f"({len(agency_pairs)} agencies) to pulsepoint-queue."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"PulsePoint dispatch failed: {exc}")
        raise
    finally:
        db_session.close()


# ── Batch worker task ──

@celery_app.task(soft_time_limit=90, time_limit=120)
def poll_agency_batch(agency_pairs: list[list[str]]) -> str:
    """
    Worker: poll a sub-batch of agencies sequentially with rate limiting.

    Parameters
    ----------
    agency_pairs : list[list[str]]
        List of [agency_id, agency_uuid_str] pairs.
    """
    from uuid import UUID

    from app.tasks.fire_lead_rotation import process_new_fire_incidents

    db_session = SessionLocal()
    try:
        total_incidents = 0
        polled = 0
        all_new_ids: list[str] = []

        for agency_id, agency_uuid_str in agency_pairs:
            agency_uuid = UUID(agency_uuid_str)
            count, new_ids = _poll_single_agency(db_session, agency_id, agency_uuid)
            if count >= 0:
                total_incidents += count
                polled += 1
                if new_ids:
                    all_new_ids.extend(str(uid) for uid in new_ids)
                celery_log.info(
                    f"Agency {agency_id}: {count} incidents processed, {len(new_ids)} new."
                )

            time.sleep(INTER_REQUEST_DELAY)

        # Enqueue auto-lead rotation for any new incidents
        if all_new_ids:
            process_new_fire_incidents.delay(all_new_ids)
            celery_log.info(
                f"Enqueued {len(all_new_ids)} new incidents for fire lead rotation."
            )

            # Notify admin users about new fire incidents
            try:
                from sqlalchemy import select
                from app.models.user import User
                from app.models.role import Role
                from app.utils.notifications import create_notification

                stmt = (
                    select(User)
                    .join(Role, User.role_id == Role.id)
                    .where(
                        User.is_active == True,
                        Role.name.in_(("admin", "super-admin")),
                    )
                )
                admins = db_session.execute(stmt).scalars().all()
                for admin in admins:
                    create_notification(
                        db_session,
                        user_id=admin.id,
                        title="New Fire Incidents Detected",
                        message=f"{len(all_new_ids)} new fire incident(s) detected from PulsePoint polling.",
                        notification_type="system",
                        link="/#/app/fire-incidents",
                    )
                db_session.commit()
            except Exception as exc:
                db_session.rollback()
                celery_log.error(f"Failed to create admin fire incident notifications: {exc}")

        summary = (
            f"Batch complete: polled {polled}/{len(agency_pairs)} agencies, "
            f"{total_incidents} incidents processed, {len(all_new_ids)} new."
        )
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"PulsePoint batch task failed: {exc}")
        raise
    finally:
        db_session.close()


# ── Legacy fallback (manual trigger) ──

@celery_app.task()
def poll_pulsepoint_agencies() -> str:
    """
    Legacy task: poll ALL active PulsePoint agencies sequentially.

    Kept as a manual-trigger fallback. Not on the beat schedule.
    """
    db_session = SessionLocal()
    try:
        agencies = crud.fire_agency.get_active(db_session)
        if not agencies:
            celery_log.info("PulsePoint poll: no active agencies found.")
            return "No active agencies to poll."

        from app.tasks.fire_lead_rotation import process_new_fire_incidents

        total_incidents = 0
        polled = 0
        all_new_ids: list[str] = []

        for agency in agencies:
            celery_log.info(f"Polling PulsePoint agency: {agency.agency_id} ({agency.name})")
            count, new_ids = _poll_single_agency(db_session, agency.agency_id, agency.id)
            if count >= 0:
                total_incidents += count
                polled += 1
                if new_ids:
                    all_new_ids.extend(str(uid) for uid in new_ids)
                celery_log.info(
                    f"Agency {agency.agency_id}: {count} incidents processed."
                )

        if all_new_ids:
            process_new_fire_incidents.delay(all_new_ids)
            celery_log.info(f"Enqueued {len(all_new_ids)} new incidents for fire lead rotation.")

        summary = f"Polled {polled}/{len(agencies)} agencies, {total_incidents} total incidents processed."
        celery_log.info(summary)
        return summary

    except Exception as exc:
        celery_log.error(f"PulsePoint poll task failed: {exc}")
        raise
    finally:
        db_session.close()
