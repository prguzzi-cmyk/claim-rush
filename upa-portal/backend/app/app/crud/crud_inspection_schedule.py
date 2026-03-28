#!/usr/bin/env python

"""CRUD operations for inspection schedules"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.inspection_schedule import InspectionSchedule
from app.schemas.inspection_schedule import InspectionScheduleCreate, InspectionScheduleUpdate


class CRUDInspectionSchedule(CRUDBase[InspectionSchedule, InspectionScheduleCreate, InspectionScheduleUpdate]):

    def get_filtered(
        self,
        db_session: Session,
        *,
        date: str | None = None,
        adjuster_id: UUID | None = None,
        status: str | None = None,
    ) -> Sequence[InspectionSchedule]:
        with db_session as session:
            conditions = []
            if date:
                conditions.append(InspectionSchedule.inspection_date == date)
            if adjuster_id:
                conditions.append(InspectionSchedule.adjuster_id == adjuster_id)
            if status:
                conditions.append(InspectionSchedule.status == status)

            stmt = select(InspectionSchedule)
            if conditions:
                stmt = stmt.where(and_(*conditions))
            stmt = stmt.order_by(InspectionSchedule.inspection_date, InspectionSchedule.inspection_time)
            return session.scalars(stmt).all()

    def check_conflict(
        self,
        db_session: Session,
        *,
        adjuster_id: UUID,
        date: str,
        time: str,
        exclude_id: UUID | None = None,
    ) -> InspectionSchedule | None:
        with db_session as session:
            conditions = [
                InspectionSchedule.adjuster_id == adjuster_id,
                InspectionSchedule.inspection_date == date,
                InspectionSchedule.inspection_time == time,
                InspectionSchedule.status != "cancelled",
            ]
            if exclude_id:
                conditions.append(InspectionSchedule.id != exclude_id)
            stmt = select(InspectionSchedule).where(and_(*conditions))
            return session.scalars(stmt).first()

    def get_upcoming(
        self,
        db_session: Session,
        *,
        limit: int = 10,
    ) -> Sequence[InspectionSchedule]:
        from datetime import date as date_mod

        today = date_mod.today().isoformat()
        with db_session as session:
            stmt = (
                select(InspectionSchedule)
                .where(
                    and_(
                        InspectionSchedule.inspection_date >= today,
                        InspectionSchedule.status != "cancelled",
                    )
                )
                .order_by(InspectionSchedule.inspection_date, InspectionSchedule.inspection_time)
                .limit(limit)
            )
            return session.scalars(stmt).all()


inspection_schedule = CRUDInspectionSchedule(InspectionSchedule)
