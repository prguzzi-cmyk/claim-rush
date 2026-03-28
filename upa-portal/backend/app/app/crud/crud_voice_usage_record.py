#!/usr/bin/env python

"""CRUD operations for voice usage records"""

from datetime import date
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.voice_usage_record import VoiceUsageRecord
from app.schemas.voice_campaign import VoiceUsageRecordBase, VoiceUsageRecordBase


class CRUDVoiceUsageRecord(CRUDBase[VoiceUsageRecord, VoiceUsageRecordBase, VoiceUsageRecordBase]):

    def get_current_period(
        self, db_session: Session, *, account_id: UUID
    ) -> VoiceUsageRecord | None:
        today = date.today()
        with db_session as session:
            stmt = (
                select(VoiceUsageRecord)
                .where(
                    and_(
                        VoiceUsageRecord.account_id == account_id,
                        VoiceUsageRecord.period_start <= today,
                        VoiceUsageRecord.period_end >= today,
                    )
                )
            )
            return session.scalars(stmt).first()

    def increment_usage(
        self,
        db_session: Session,
        *,
        account_id: UUID,
        minutes: float,
        cost_cents: int = 0,
    ) -> VoiceUsageRecord | None:
        record = self.get_current_period(db_session, account_id=account_id)
        if not record:
            return None
        with db_session as session:
            record.minutes_used += minutes
            record.call_count += 1
            record.cost_cents += cost_cents
            if record.minutes_used > record.plan_limit_minutes:
                record.overage_minutes = record.minutes_used - record.plan_limit_minutes
            session.add(record)
            session.flush()
            return record

    def check_limit(
        self, db_session: Session, *, account_id: UUID
    ) -> bool:
        record = self.get_current_period(db_session, account_id=account_id)
        if not record:
            return True
        return record.minutes_used < record.plan_limit_minutes


voice_usage_record = CRUDVoiceUsageRecord(VoiceUsageRecord)
