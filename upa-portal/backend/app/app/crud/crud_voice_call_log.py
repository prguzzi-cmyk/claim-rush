#!/usr/bin/env python

"""CRUD operations for voice call logs"""

from collections.abc import Sequence
from uuid import UUID

from datetime import date, timedelta

from sqlalchemy import and_, cast, func, select, Date
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.voice_call_log import VoiceCallLog
from app.schemas.voice_campaign import VoiceCallLogCreate, VoiceCampaignUpdate


class CRUDVoiceCallLog(CRUDBase[VoiceCallLog, VoiceCallLogCreate, VoiceCampaignUpdate]):

    def get_by_campaign(
        self, db_session: Session, *, campaign_id: UUID
    ) -> Sequence[VoiceCallLog]:
        with db_session as session:
            stmt = (
                select(VoiceCallLog)
                .where(VoiceCallLog.campaign_id == campaign_id)
                .order_by(VoiceCallLog.created_at.desc())
            )
            return session.scalars(stmt).all()

    def get_by_lead(
        self, db_session: Session, *, lead_id: UUID
    ) -> Sequence[VoiceCallLog]:
        with db_session as session:
            stmt = (
                select(VoiceCallLog)
                .where(VoiceCallLog.lead_id == lead_id)
                .order_by(VoiceCallLog.created_at.desc())
            )
            return session.scalars(stmt).all()

    def get_filtered(
        self,
        db_session: Session,
        *,
        campaign_id: UUID | None = None,
        outcome: str | None = None,
    ) -> Sequence[VoiceCallLog]:
        with db_session as session:
            stmt = select(VoiceCallLog)
            filters = []
            if campaign_id:
                filters.append(VoiceCallLog.campaign_id == campaign_id)
            if outcome:
                filters.append(VoiceCallLog.outcome == outcome)
            if filters:
                stmt = stmt.where(and_(*filters))
            stmt = stmt.order_by(VoiceCallLog.created_at.desc())
            return session.scalars(stmt).all()

    def get_with_transcript(
        self, db_session: Session, *, obj_id: UUID
    ) -> VoiceCallLog | None:
        with db_session as session:
            return session.get(VoiceCallLog, obj_id)

    def get_analytics(
        self, db_session: Session, *, campaign_id: UUID | None = None
    ) -> dict:
        with db_session as session:
            base_filter = []
            if campaign_id:
                base_filter.append(VoiceCallLog.campaign_id == campaign_id)

            # Total calls
            total_stmt = select(func.count(VoiceCallLog.id)).where(*base_filter) if base_filter else select(func.count(VoiceCallLog.id))
            total_calls = session.scalar(total_stmt) or 0

            # Answered calls
            answered_filter = base_filter + [VoiceCallLog.status == "completed"]
            answered_stmt = select(func.count(VoiceCallLog.id)).where(and_(*answered_filter)) if answered_filter else select(func.count(VoiceCallLog.id))
            calls_answered = session.scalar(answered_stmt) or 0

            # Average duration
            avg_stmt = select(func.avg(VoiceCallLog.duration_seconds)).where(*base_filter) if base_filter else select(func.avg(VoiceCallLog.duration_seconds))
            avg_duration = session.scalar(avg_stmt) or 0.0

            # Outcome breakdown
            outcome_stmt = (
                select(VoiceCallLog.outcome, func.count(VoiceCallLog.id))
                .where(*base_filter)
                .group_by(VoiceCallLog.outcome)
            ) if base_filter else (
                select(VoiceCallLog.outcome, func.count(VoiceCallLog.id))
                .group_by(VoiceCallLog.outcome)
            )
            outcome_rows = session.execute(outcome_stmt).all()
            outcome_breakdown = {
                (row[0] or "unknown"): row[1] for row in outcome_rows
            }

            conversion_rate = 0.0
            if total_calls > 0:
                booked = outcome_breakdown.get("appointment_booked", 0)
                conversion_rate = round(booked / total_calls * 100, 1)

            # Daily trend (last 30 days)
            thirty_days_ago = date.today() - timedelta(days=30)
            trend_filter = base_filter + [cast(VoiceCallLog.created_at, Date) >= thirty_days_ago]
            trend_stmt = (
                select(
                    cast(VoiceCallLog.created_at, Date).label("day"),
                    func.count(VoiceCallLog.id).label("count"),
                )
                .where(and_(*trend_filter))
                .group_by(cast(VoiceCallLog.created_at, Date))
                .order_by(cast(VoiceCallLog.created_at, Date))
            )
            trend_rows = session.execute(trend_stmt).all()
            daily_trend = [
                {"date": row.day.isoformat(), "count": row.count}
                for row in trend_rows
            ]

            return {
                "total_calls": total_calls,
                "calls_answered": calls_answered,
                "conversion_rate": conversion_rate,
                "avg_duration_seconds": round(float(avg_duration), 1),
                "outcome_breakdown": outcome_breakdown,
                "daily_trend": daily_trend,
            }


voice_call_log = CRUDVoiceCallLog(VoiceCallLog)
