#!/usr/bin/env python

"""CRUD operations for the PropertyIntelligence model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.property_intelligence import PropertyIntelligence
from app.schemas.property_intelligence import PropertyIntelligenceCreate, PropertyIntelligenceUpdate


class CRUDPropertyIntelligence(CRUDBase[PropertyIntelligence, PropertyIntelligenceCreate, PropertyIntelligenceUpdate]):
    def get_by_incident_id(self, db_session: Session, *, incident_id: UUID) -> PropertyIntelligence | None:
        with db_session as session:
            stmt = select(self.model).where(self.model.incident_id == incident_id)
            return session.scalar(stmt)


property_intelligence = CRUDPropertyIntelligence(PropertyIntelligence)
