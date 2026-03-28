#!/usr/bin/env python

"""CRUD operations for adjuster availability"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.adjuster_availability import AdjusterAvailability, AdjusterBlockedSlot
from app.schemas.adjuster_availability import AdjusterAvailabilityCreate, AdjusterAvailabilityUpdate


class CRUDAdjusterAvailability(CRUDBase[AdjusterAvailability, AdjusterAvailabilityCreate, AdjusterAvailabilityUpdate]):

    def get_by_adjuster(
        self,
        db_session: Session,
        *,
        adjuster_id: UUID,
    ) -> AdjusterAvailability | None:
        with db_session as session:
            stmt = select(AdjusterAvailability).where(
                AdjusterAvailability.adjuster_id == adjuster_id
            )
            return session.scalars(stmt).first()

    def save_or_update(
        self,
        db_session: Session,
        *,
        adjuster_id: UUID,
        obj_in: AdjusterAvailabilityCreate,
    ) -> AdjusterAvailability:
        with db_session as session:
            stmt = select(AdjusterAvailability).where(
                AdjusterAvailability.adjuster_id == adjuster_id
            )
            existing = session.scalars(stmt).first()

            if existing:
                existing.available_days = obj_in.available_days or existing.available_days
                existing.start_hour = obj_in.start_hour if obj_in.start_hour is not None else existing.start_hour
                existing.end_hour = obj_in.end_hour if obj_in.end_hour is not None else existing.end_hour
                # Replace blocked slots
                existing.blocked_slots.clear()
                for slot_in in obj_in.blocked_slots:
                    slot = AdjusterBlockedSlot(
                        availability_id=existing.id,
                        date=slot_in.date,
                        start_time=slot_in.start_time,
                        end_time=slot_in.end_time,
                        reason=slot_in.reason,
                    )
                    existing.blocked_slots.append(slot)
                session.commit()
                session.refresh(existing)
                return existing
            else:
                avail = AdjusterAvailability(
                    adjuster_id=adjuster_id,
                    available_days=obj_in.available_days or "[1,2,3,4,5]",
                    start_hour=obj_in.start_hour if obj_in.start_hour is not None else 8,
                    end_hour=obj_in.end_hour if obj_in.end_hour is not None else 17,
                )
                for slot_in in obj_in.blocked_slots:
                    slot = AdjusterBlockedSlot(
                        date=slot_in.date,
                        start_time=slot_in.start_time,
                        end_time=slot_in.end_time,
                        reason=slot_in.reason,
                    )
                    avail.blocked_slots.append(slot)
                session.add(avail)
                session.commit()
                session.refresh(avail)
                return avail


adjuster_availability = CRUDAdjusterAvailability(AdjusterAvailability)
