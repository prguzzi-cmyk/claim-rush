#!/usr/bin/env python

"""CRUD operations for campaign steps"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.campaign_step import CampaignStep
from app.schemas.campaign_step import CampaignStepCreate, CampaignStepUpdate


class CRUDCampaignStep(CRUDBase[CampaignStep, CampaignStepCreate, CampaignStepUpdate]):

    def get_by_campaign(self, db_session: Session, *, campaign_id: UUID) -> Sequence[CampaignStep]:
        with db_session as session:
            stmt = (
                select(CampaignStep)
                .where(CampaignStep.campaign_id == campaign_id)
                .order_by(CampaignStep.step_number)
            )
            return session.scalars(stmt).all()


campaign_step = CRUDCampaignStep(CampaignStep)
