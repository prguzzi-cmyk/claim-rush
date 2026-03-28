#!/usr/bin/env python

"""
Celery tasks for voice campaign call processing.

Flow:
  1. process_voice_campaign_calls — periodic task that finds active campaigns
     with pending call logs and dispatches calls via VAPI within the
     configured call window and daily limits.
  2. process_single_campaign_call — dispatches one call for a pending
     VoiceCallLog record using the voice provider.
"""

import logging
from datetime import datetime, timezone, time
from uuid import UUID

import pytz
from sqlalchemy import and_, func, select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


def _is_within_call_window(
    start_str: str, end_str: str, tz_name: str
) -> bool:
    """Check if the current time falls within the campaign's call window."""
    try:
        tz = pytz.timezone(tz_name)
    except pytz.exceptions.UnknownTimeZoneError:
        tz = pytz.timezone("America/New_York")

    now = datetime.now(tz).time()
    parts_start = start_str.split(":")
    parts_end = end_str.split(":")
    window_start = time(int(parts_start[0]), int(parts_start[1]))
    window_end = time(int(parts_end[0]), int(parts_end[1]))
    return window_start <= now <= window_end


@celery_app.task(
    bind=True,
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=120,
    name="app.tasks.voice_campaign.process_voice_campaign_calls",
)
def process_voice_campaign_calls(self):
    """
    Periodic task: iterate active campaigns, check call windows,
    and dispatch pending calls up to the daily limit.
    """
    task_id = self.request.id
    logger.info("[VoiceCampaign:%s] Starting campaign call processing", task_id)

    db = SessionLocal()
    try:
        from app.models.voice_campaign import VoiceCampaign
        from app.models.voice_call_log import VoiceCallLog

        # Find active campaigns
        stmt = (
            select(VoiceCampaign)
            .where(
                and_(
                    VoiceCampaign.status == "active",
                    VoiceCampaign.is_removed.is_(False),
                )
            )
        )
        campaigns = db.scalars(stmt).all()
        logger.info("[VoiceCampaign:%s] Found %d active campaigns", task_id, len(campaigns))

        for campaign in campaigns:
            # Check call window
            window_start = campaign.call_window_start or "09:00"
            window_end = campaign.call_window_end or "17:00"
            tz_name = campaign.call_window_timezone or "America/New_York"

            if not _is_within_call_window(window_start, window_end, tz_name):
                logger.info(
                    "[VoiceCampaign:%s] Campaign %s outside call window (%s-%s %s)",
                    task_id, campaign.id, window_start, window_end, tz_name,
                )
                continue

            # Check daily call limit
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            calls_today_stmt = (
                select(func.count(VoiceCallLog.id))
                .where(
                    and_(
                        VoiceCallLog.campaign_id == campaign.id,
                        VoiceCallLog.status != "pending",
                        VoiceCallLog.created_at >= today_start,
                    )
                )
            )
            calls_today = db.scalar(calls_today_stmt) or 0
            max_daily = campaign.max_calls_per_day or 100
            remaining = max(0, max_daily - calls_today)

            if remaining == 0:
                logger.info(
                    "[VoiceCampaign:%s] Campaign %s hit daily limit (%d)",
                    task_id, campaign.id, max_daily,
                )
                continue

            # Get pending call logs for this campaign
            pending_stmt = (
                select(VoiceCallLog)
                .where(
                    and_(
                        VoiceCallLog.campaign_id == campaign.id,
                        VoiceCallLog.status == "pending",
                    )
                )
                .order_by(VoiceCallLog.created_at.asc())
                .limit(remaining)
            )
            pending_calls = db.scalars(pending_stmt).all()

            if not pending_calls:
                # No more pending calls — mark campaign as completed
                campaign.status = "completed"
                campaign.completed_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(
                    "[VoiceCampaign:%s] Campaign %s completed (no pending calls)",
                    task_id, campaign.id,
                )
                continue

            logger.info(
                "[VoiceCampaign:%s] Dispatching %d calls for campaign %s",
                task_id, len(pending_calls), campaign.id,
            )

            for call_log in pending_calls:
                process_single_campaign_call.delay(str(call_log.id))

    except Exception as exc:
        db.rollback()
        logger.error(
            "[VoiceCampaign:%s] process_voice_campaign_calls failed: %s",
            task_id, exc, exc_info=True,
        )
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=120,
    name="app.tasks.voice_campaign.process_single_campaign_call",
)
def process_single_campaign_call(self, call_log_id: str):
    """
    Dispatch a single outbound call for a pending VoiceCallLog record.
    Uses the VAPI voice provider to initiate the call and updates the log.
    """
    task_id = self.request.id
    logger.info("[VoiceCampaignCall:%s] Processing call_log %s", task_id, call_log_id)

    db = SessionLocal()
    try:
        from app.models.voice_call_log import VoiceCallLog
        from app.models.voice_campaign import VoiceCampaign
        from app.utils.voice import get_voice_provider

        call_log = db.get(VoiceCallLog, call_log_id)
        if not call_log:
            logger.warning("[VoiceCampaignCall:%s] Call log %s not found", task_id, call_log_id)
            return

        if call_log.status != "pending":
            logger.info(
                "[VoiceCampaignCall:%s] Call log %s already processed (status=%s)",
                task_id, call_log_id, call_log.status,
            )
            return

        # Get campaign for script context
        campaign = db.get(VoiceCampaign, call_log.campaign_id) if call_log.campaign_id else None

        phone = call_log.phone_number
        if not phone or phone in ("", "N/A"):
            call_log.status = "failed"
            call_log.outcome = "wrong_number"
            call_log.ended_at = datetime.now(timezone.utc)
            db.commit()
            logger.info("[VoiceCampaignCall:%s] No valid phone for call_log %s", task_id, call_log_id)
            return

        voice = get_voice_provider()
        if not voice:
            logger.warning("[VoiceCampaignCall:%s] Voice provider not available", task_id)
            call_log.status = "failed"
            call_log.ended_at = datetime.now(timezone.utc)
            db.commit()
            return

        # Build lead context for the AI agent
        lead_context = {
            "lead_name": call_log.lead_name or "Sir or Ma'am",
            "campaign_name": campaign.name if campaign else "",
            "script_template": campaign.script_template if campaign else "",
        }

        # Initiate the call
        call_log.status = "initiated"
        call_log.started_at = datetime.now(timezone.utc)
        db.commit()

        result = voice.initiate_outbound_call(
            to_phone=phone,
            lead_context=lead_context,
        )

        if result.success:
            call_log.call_sid = result.call_id
            call_log.status = "ringing"
            logger.info(
                "[VoiceCampaignCall:%s] Call initiated for %s, call_sid=%s",
                task_id, phone, result.call_id,
            )
        else:
            call_log.status = "failed"
            call_log.ended_at = datetime.now(timezone.utc)
            call_log.retry_count += 1
            logger.error(
                "[VoiceCampaignCall:%s] Call failed for %s: %s",
                task_id, phone, result.error,
            )

            # Handle retries
            max_retries = campaign.max_retries if campaign else 3
            if call_log.retry_count < max_retries:
                retry_delay = (campaign.retry_delay_minutes if campaign else 120) * 60
                call_log.status = "pending"
                db.commit()
                process_single_campaign_call.apply_async(
                    args=[call_log_id],
                    countdown=retry_delay,
                )
                return

        # Update campaign stats
        if campaign:
            placed_stmt = (
                select(func.count(VoiceCallLog.id))
                .where(
                    and_(
                        VoiceCallLog.campaign_id == campaign.id,
                        VoiceCallLog.status != "pending",
                    )
                )
            )
            campaign.total_calls_placed = db.scalar(placed_stmt) or 0

        db.commit()

    except Exception as exc:
        db.rollback()
        logger.error(
            "[VoiceCampaignCall:%s] process_single_campaign_call failed: %s",
            task_id, exc, exc_info=True,
        )
        raise self.retry(exc=exc)
    finally:
        db.close()
