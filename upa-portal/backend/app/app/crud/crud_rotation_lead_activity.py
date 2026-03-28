#!/usr/bin/env python

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.rotation_lead_activity import RotationLeadActivity
from app.schemas.rotation_lead import (
    RotationLeadActivityCreate,
    RotationLeadActivityBase,
)


class CRUDRotationLeadActivity(
    CRUDBase[RotationLeadActivity, RotationLeadActivityCreate, RotationLeadActivityBase]
):

    def get_by_lead(
        self, db_session: Session, *, rotation_lead_id: UUID
    ) -> Sequence[RotationLeadActivity]:
        """Return all activities for a given rotation lead, newest first."""
        with db_session as session:
            stmt = (
                select(RotationLeadActivity)
                .where(RotationLeadActivity.rotation_lead_id == rotation_lead_id)
                .order_by(RotationLeadActivity.created_at.desc())
            )
            return session.scalars(stmt).all()


rotation_lead_activity = CRUDRotationLeadActivity(RotationLeadActivity)
