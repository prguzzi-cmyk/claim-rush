#!/usr/bin/env python

"""CRUD operations for the lead_owner_intelligence model"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_owner_intelligence import LeadOwnerIntelligence
from app.schemas.lead_owner_intelligence import (
    LeadOwnerIntelligenceCreate,
    LeadOwnerIntelligenceUpdate,
)


class CRUDLeadOwnerIntelligence(
    CRUDBase[LeadOwnerIntelligence, LeadOwnerIntelligenceCreate, LeadOwnerIntelligenceUpdate]
):

    @staticmethod
    def get_by_lead_id(
        db_session: Session, lead_id: UUID
    ) -> LeadOwnerIntelligence | None:
        with db_session as session:
            return (
                session.query(LeadOwnerIntelligence)
                .filter(LeadOwnerIntelligence.lead_id == lead_id)
                .one_or_none()
            )


lead_owner_intelligence = CRUDLeadOwnerIntelligence(LeadOwnerIntelligence)
