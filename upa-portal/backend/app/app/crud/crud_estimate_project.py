#!/usr/bin/env python

"""CRUD operations for the EstimateProject model"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models.commission_claim import CommissionClaim
from app.models.estimate_project import EstimateProject
from app.models.estimate_room import EstimateRoom
from app.models.estimate_line_item import EstimateLineItem
from app.schemas.estimate_project import EstimateProjectCreate, EstimateProjectUpdate


def _sync_firm_estimate_to_claim(
    db_session: Session, project: EstimateProject
) -> None:
    """Push the project's total_cost into commission_claim.estimate_amount
    when the project is linked to a claim. Firm estimate is the
    authoritative source — overwrites any prior value (manual or carrier).

    No-op when:
      - project has no commission_claim_id (not linked)
      - project.total_cost is None or 0 (nothing meaningful to push)

    The tier-eligibility recalculation needed by the Issue Advance dialog
    happens implicitly: the dialog reads claim.estimate_amount fresh on
    every open and runs compute_tier_amount() against it. Already-issued
    advances live in their own ledger rows and are NOT retroactively
    modified — they reflect the tier at the time they were issued.
    """
    if project.commission_claim_id is None:
        return
    if project.total_cost is None or project.total_cost <= 0:
        return
    claim = db_session.get(CommissionClaim, project.commission_claim_id)
    if claim is None:
        return
    claim.estimate_amount = Decimal(str(project.total_cost))
    db_session.add(claim)


class CRUDEstimateProject(CRUDBase[EstimateProject, EstimateProjectCreate, EstimateProjectUpdate]):
    def get_with_details(self, db_session: Session, *, obj_id: UUID) -> EstimateProject | None:
        """
        Retrieve a project with all nested rooms, line items, measurements, and photos.
        """
        with db_session as session:
            stmt = (
                select(EstimateProject)
                .options(
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.line_items),
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.measurements),
                    selectinload(EstimateProject.rooms)
                    .selectinload(EstimateRoom.photos),
                    selectinload(EstimateProject.photos),
                    selectinload(EstimateProject.fire_claim),
                )
                .where(EstimateProject.id == obj_id)
            )
            if hasattr(EstimateProject, "is_removed"):
                stmt = stmt.where(EstimateProject.is_removed.is_(False))
            return session.scalar(stmt)

    def create_with_rooms(
        self, db_session: Session, *, obj_in: EstimateProjectCreate
    ) -> EstimateProject:
        """
        Create a project with nested rooms and line items in one transaction.
        """
        with db_session as session:
            project = EstimateProject(
                name=obj_in.name,
                status=obj_in.status or "draft",
                estimate_mode=obj_in.estimate_mode or "residential",
                total_cost=obj_in.total_cost,
                notes=obj_in.notes,
                claim_id=obj_in.claim_id,
                commission_claim_id=obj_in.commission_claim_id,
            )
            session.add(project)
            session.flush()

            if obj_in.rooms:
                for room_in in obj_in.rooms:
                    room = EstimateRoom(
                        name=room_in.name,
                        room_type=room_in.room_type,
                        floor_level=room_in.floor_level,
                        notes=room_in.notes,
                        project_id=project.id,
                    )
                    session.add(room)
                    session.flush()

                    if room_in.line_items:
                        for item_in in room_in.line_items:
                            line_item = EstimateLineItem(
                                description=item_in.description,
                                quantity=item_in.quantity,
                                unit=item_in.unit,
                                unit_cost=item_in.unit_cost,
                                total_cost=item_in.total_cost,
                                notes=item_in.notes,
                                category=item_in.category,
                                room_id=room.id,
                            )
                            session.add(line_item)

            # Firm estimate auto-populates the linked claim's estimate_amount.
            # Single-transaction with the project create.
            _sync_firm_estimate_to_claim(session, project)

            session.commit()
            project_id = project.id

        # Re-fetch with eager loading so relationships are available after session closes
        return self.get_with_details(db_session, obj_id=project_id)

    def update(
        self,
        db_session: Session,
        *,
        db_obj: EstimateProject,
        obj_in: EstimateProjectUpdate | dict[str, Any],
    ) -> EstimateProject:
        """Override of CRUDBase.update so that any change to total_cost
        or commission_claim_id triggers an in-transaction sync of the
        linked claim's estimate_amount. Firm estimate is the authoritative
        source — overwrite is intentional, no warning.

        We reimplement the apply-and-commit cycle here (rather than calling
        super().update() then syncing) because CRUDBase.update wraps its
        body in `with db_session as session:` which closes the session on
        exit, leaving no live session for follow-up writes."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            session.add(db_obj)
            # Flush so the relationship/column changes are visible to the
            # sync helper, but defer commit until after the cross-table write.
            session.flush()
            _sync_firm_estimate_to_claim(session, db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj


estimate_project = CRUDEstimateProject(EstimateProject)
