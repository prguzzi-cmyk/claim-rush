#!/usr/bin/env python

"""Business logic for voice campaign operations"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app import crud
from app.schemas.voice_campaign import (
    VoiceCampaignAnalytics,
    VoiceCampaignCreate,
    VoiceCallLogCreate,
    VoiceUsageSummary,
)

logger = logging.getLogger(__name__)


class VoiceCampaignService:

    @staticmethod
    def create_campaign(
        db_session: Session, *, data: VoiceCampaignCreate, user_id: UUID
    ):
        obj_in = data.model_copy(update={"status": "draft"})
        campaign = crud.voice_campaign.create(db_session=db_session, obj_in=obj_in)
        with db_session as session:
            campaign.created_by_id = user_id
            session.add(campaign)
            session.flush()
        return campaign

    @staticmethod
    def launch_campaign(
        db_session: Session, *, campaign_id: UUID, lead_ids: list[UUID], user_id: UUID
    ):
        campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
        if not campaign:
            return None

        with db_session as session:
            campaign.status = "active"
            campaign.launched_at = datetime.now(timezone.utc)
            campaign.total_leads_targeted = len(lead_ids)
            session.add(campaign)

            # Create pending call logs for each lead
            for lead_id in lead_ids:
                lead = crud.lead.get(db_session=db_session, obj_id=lead_id)
                phone = ""
                lead_name = ""
                if lead and hasattr(lead, "contact") and lead.contact:
                    phone = lead.contact.phone_number or ""
                    lead_name = lead.contact.full_name or ""
                call_log_data = VoiceCallLogCreate(
                    phone_number=phone,
                    campaign_id=campaign_id,
                    lead_id=lead_id,
                    lead_name=lead_name,
                    status="pending",
                )
                crud.voice_call_log.create(db_session=db_session, obj_in=call_log_data)

            session.flush()
        return campaign

    @staticmethod
    def pause_campaign(db_session: Session, *, campaign_id: UUID):
        campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
        if not campaign:
            return None
        with db_session as session:
            campaign.status = "paused"
            session.add(campaign)
            session.flush()
        return campaign

    @staticmethod
    def record_call_result(
        db_session: Session,
        *,
        call_log_id: UUID,
        status: str,
        outcome: str | None = None,
        duration_seconds: int = 0,
        transcript_text: str | None = None,
        transcript_summary: str | None = None,
        recording_url: str | None = None,
        cost_cents: int = 0,
    ):
        call_log = crud.voice_call_log.get(db_session=db_session, obj_id=call_log_id)
        if not call_log:
            return None

        with db_session as session:
            call_log.status = status
            call_log.outcome = outcome
            call_log.duration_seconds = duration_seconds
            call_log.ended_at = datetime.now(timezone.utc)
            if transcript_text:
                call_log.transcript_text = transcript_text
            if transcript_summary:
                call_log.transcript_summary = transcript_summary
            if recording_url:
                call_log.recording_url = recording_url
            call_log.cost_cents = cost_cents
            session.add(call_log)
            session.flush()

        return call_log

    @staticmethod
    def get_campaign_analytics(
        db_session: Session, *, campaign_id: UUID
    ) -> VoiceCampaignAnalytics:
        data = crud.voice_call_log.get_analytics(
            db_session, campaign_id=campaign_id
        )
        return VoiceCampaignAnalytics(**data)

    @staticmethod
    def get_global_analytics(db_session: Session) -> VoiceCampaignAnalytics:
        data = crud.voice_call_log.get_analytics(db_session)
        return VoiceCampaignAnalytics(**data)

    @staticmethod
    def get_usage_summary(
        db_session: Session, *, account_id: UUID
    ) -> VoiceUsageSummary:
        record = crud.voice_usage_record.get_current_period(
            db_session, account_id=account_id
        )
        if not record:
            return VoiceUsageSummary()

        percent = 0.0
        if record.plan_limit_minutes > 0:
            percent = round(record.minutes_used / record.plan_limit_minutes * 100, 1)

        return VoiceUsageSummary(
            minutes_used=record.minutes_used,
            plan_limit_minutes=record.plan_limit_minutes,
            percent_used=percent,
            call_count=record.call_count,
            overage_minutes=record.overage_minutes,
        )


voice_campaign_service = VoiceCampaignService()
