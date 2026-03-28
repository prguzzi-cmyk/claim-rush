#!/usr/bin/env python

"""CRUD operations for the CarrierEstimate model"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models.carrier_estimate import CarrierEstimate, CarrierLineItem
from app.schemas.carrier_estimate import CarrierEstimateCreate, CarrierEstimateUpdate


class CRUDCarrierEstimate(CRUDBase[CarrierEstimate, CarrierEstimateCreate, CarrierEstimateUpdate]):
    def get_with_items(self, db_session: Session, *, obj_id: UUID) -> CarrierEstimate | None:
        """Retrieve a carrier estimate with eager-loaded line items."""
        with db_session as session:
            stmt = (
                select(CarrierEstimate)
                .options(selectinload(CarrierEstimate.line_items))
                .where(CarrierEstimate.id == obj_id)
            )
            return session.scalar(stmt)

    def get_by_project(self, db_session: Session, *, project_id: UUID) -> list[CarrierEstimate]:
        """Get all carrier estimates for a project."""
        with db_session as session:
            stmt = (
                select(CarrierEstimate)
                .options(selectinload(CarrierEstimate.line_items))
                .where(CarrierEstimate.project_id == project_id)
                .order_by(CarrierEstimate.created_at.desc())
            )
            return list(session.scalars(stmt).all())

    def create_with_items(
        self,
        db_session: Session,
        *,
        project_id: UUID,
        carrier_name: str,
        upload_type: str = "pdf",
        file_name: str | None = None,
        file_key: str | None = None,
        raw_text: str | None = None,
        line_items: list[dict] | None = None,
        parser_type: str | None = None,
        parse_confidence: str | None = None,
    ) -> CarrierEstimate:
        """Create a carrier estimate with nested line items in one transaction."""
        with db_session as session:
            total_cost = 0.0
            estimate = CarrierEstimate(
                project_id=project_id,
                carrier_name=carrier_name,
                upload_type=upload_type,
                file_name=file_name,
                file_key=file_key,
                raw_text=raw_text,
                status="parsed",
                parser_type=parser_type,
                parse_confidence=parse_confidence,
            )
            session.add(estimate)
            session.flush()

            if line_items:
                for idx, item in enumerate(line_items):
                    item_total = item.get("total_cost") or (
                        (item.get("quantity", 1.0) or 1.0) * (item.get("unit_cost", 0) or 0)
                    )
                    total_cost += item_total or 0
                    li = CarrierLineItem(
                        carrier_estimate_id=estimate.id,
                        description=item.get("description"),
                        quantity=item.get("quantity", 1.0),
                        unit=item.get("unit"),
                        unit_cost=item.get("unit_cost"),
                        total_cost=item_total,
                        category=item.get("category"),
                        line_item_code=item.get("line_item_code"),
                        confidence=item.get("confidence"),
                        room_name=item.get("room_name"),
                        matched_room_id=item.get("matched_room_id"),
                        sort_order=item.get("sort_order", idx),
                    )
                    session.add(li)

            estimate.total_cost = total_cost
            session.commit()
            estimate_id = estimate.id

        return self.get_with_items(db_session, obj_id=estimate_id)

    def delete(self, db_session: Session, *, obj_id: UUID) -> bool:
        """Delete a carrier estimate (cascade deletes line items)."""
        with db_session as session:
            stmt = select(CarrierEstimate).where(CarrierEstimate.id == obj_id)
            obj = session.scalar(stmt)
            if obj:
                session.delete(obj)
                session.commit()
                return True
            return False


carrier_estimate = CRUDCarrierEstimate(CarrierEstimate)
