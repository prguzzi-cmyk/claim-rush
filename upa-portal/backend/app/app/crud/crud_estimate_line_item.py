#!/usr/bin/env python

"""CRUD operations for the EstimateLineItem model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.estimate_line_item import EstimateLineItem
from app.schemas.estimate_line_item import EstimateLineItemCreate, EstimateLineItemUpdate


class CRUDEstimateLineItem(CRUDBase[EstimateLineItem, EstimateLineItemCreate, EstimateLineItemUpdate]):
    def get_by_room(self, db_session: Session, *, room_id: UUID) -> list[EstimateLineItem]:
        """Get all line items belonging to a room."""
        with db_session as session:
            stmt = (
                select(EstimateLineItem)
                .where(EstimateLineItem.room_id == room_id)
                .order_by(EstimateLineItem.created_at)
            )
            return list(session.scalars(stmt).all())


estimate_line_item = CRUDEstimateLineItem(EstimateLineItem)
