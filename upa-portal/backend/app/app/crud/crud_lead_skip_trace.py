#!/usr/bin/env python

"""CRUD operations for the LeadSkipTrace model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_skip_trace import LeadSkipTrace
from app.schemas.lead_skip_trace import LeadSkipTraceCreate, LeadSkipTraceUpdate


class CRUDLeadSkipTrace(CRUDBase[LeadSkipTrace, LeadSkipTraceCreate, LeadSkipTraceUpdate]):
    def get_by_lead_id(self, db_session: Session, *, lead_id: UUID) -> LeadSkipTrace | None:
        with db_session as session:
            stmt = select(self.model).where(self.model.lead_id == lead_id)
            return session.scalar(stmt)


lead_skip_trace = CRUDLeadSkipTrace(LeadSkipTrace)
