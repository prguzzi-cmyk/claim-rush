#!/usr/bin/env python

"""CRUD operations for voice campaigns"""

from collections.abc import Sequence

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.voice_campaign import VoiceCampaign
from app.schemas.voice_campaign import VoiceCampaignCreate, VoiceCampaignUpdate


class CRUDVoiceCampaign(CRUDBase[VoiceCampaign, VoiceCampaignCreate, VoiceCampaignUpdate]):

    def get_active_campaigns(
        self, db_session: Session
    ) -> Sequence[VoiceCampaign]:
        with db_session as session:
            stmt = (
                select(VoiceCampaign)
                .where(
                    and_(
                        VoiceCampaign.status == "active",
                        VoiceCampaign.is_removed.is_(False),
                    )
                )
                .order_by(VoiceCampaign.created_at.desc())
            )
            return session.scalars(stmt).all()

    def get_by_status(
        self, db_session: Session, *, status: str
    ) -> Sequence[VoiceCampaign]:
        with db_session as session:
            stmt = (
                select(VoiceCampaign)
                .where(
                    and_(
                        VoiceCampaign.status == status,
                        VoiceCampaign.is_removed.is_(False),
                    )
                )
                .order_by(VoiceCampaign.created_at.desc())
            )
            return session.scalars(stmt).all()

    def update_stats(
        self,
        db_session: Session,
        *,
        campaign_id,
        total_calls_placed: int | None = None,
        total_calls_answered: int | None = None,
        total_appointments_booked: int | None = None,
    ) -> VoiceCampaign | None:
        with db_session as session:
            campaign = session.get(VoiceCampaign, campaign_id)
            if not campaign:
                return None
            if total_calls_placed is not None:
                campaign.total_calls_placed = total_calls_placed
            if total_calls_answered is not None:
                campaign.total_calls_answered = total_calls_answered
            if total_appointments_booked is not None:
                campaign.total_appointments_booked = total_appointments_booked
            session.add(campaign)
            session.flush()
            return campaign


voice_campaign = CRUDVoiceCampaign(VoiceCampaign)
