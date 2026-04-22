#!/usr/bin/env python

"""CRUD operations for the CarrierEstimate model"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config.estimate_divergence import compute_divergence
from app.crud.base import CRUDBase
from app.models.carrier_estimate import CarrierEstimate, CarrierLineItem
from app.models.commission_claim import CommissionClaim
from app.schemas.carrier_estimate import CarrierEstimateCreate, CarrierEstimateUpdate


def _sync_carrier_estimate_to_claim(
    db_session: Session, carrier_estimate: CarrierEstimate
) -> None:
    """Push the carrier estimate's total_cost into the linked claim AND
    recompute divergence vs. the firm estimate (claim.estimate_amount).

    Updates four fields on commission_claim:
        carrier_estimate_amount
        estimate_divergence_flagged
        estimate_divergence_percentage
        estimate_divergence_dollars

    No-op when:
      - carrier estimate is not linked to a claim
      - carrier total_cost is None or 0
      - linked claim doesn't exist (race / orphan)

    Carrier total ALWAYS updates carrier_estimate_amount even when no firm
    estimate exists yet — the divergence flags simply stay null/false.
    """
    if carrier_estimate.commission_claim_id is None:
        return
    if carrier_estimate.total_cost is None or carrier_estimate.total_cost <= 0:
        return
    claim = db_session.get(CommissionClaim, carrier_estimate.commission_claim_id)
    if claim is None:
        return

    claim.carrier_estimate_amount = Decimal(str(carrier_estimate.total_cost))

    result = compute_divergence(
        firm_estimate=claim.estimate_amount,
        carrier_estimate=carrier_estimate.total_cost,
    )
    claim.estimate_divergence_flagged = result["flagged"]
    claim.estimate_divergence_percentage = result["percentage"]
    claim.estimate_divergence_dollars = result["dollars"]
    db_session.add(claim)


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
        commission_claim_id: UUID | None = None,
    ) -> CarrierEstimate:
        """Create a carrier estimate with nested line items in one
        transaction. When `commission_claim_id` is supplied, the
        post-flush divergence sync runs against that claim — populating
        carrier_estimate_amount + the three divergence fields per the
        policy in app.config.estimate_divergence.
        """
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
                commission_claim_id=commission_claim_id,
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
            # Divergence sync runs after total_cost is finalized, so the
            # claim's carrier_estimate_amount + divergence flags reflect
            # the parsed total — not zero.
            _sync_carrier_estimate_to_claim(session, estimate)
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
