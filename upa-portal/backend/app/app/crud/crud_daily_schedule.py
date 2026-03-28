#!/usr/bin/env python

"""CRUD operations for the daily schedule model"""

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.enums import TaskStatus
from app.core.security import is_removed
from app.crud.base import CRUDBase
from app.models import DailySchedule
from app.schemas import DailyScheduleCreateDB, DailyScheduleUpdate


class CRUDDailySchedule(
    CRUDBase[DailySchedule, DailyScheduleCreateDB, DailyScheduleUpdate]
):
    @staticmethod
    def count_scheduled_days(db_session: Session, user_id: UUID) -> int | None:
        """
        Count the number of days scheduled for a specific user.

        Parameters
        ----------
        db_session : Session
            The database session.
        user_id : UUID
            ID of a user.

        Returns
        -------
        int | None
            Number of days scheduled.
        """
        with db_session as session:
            stmt = select(func.min(DailySchedule.created_at)).filter(
                DailySchedule.assignee_id == user_id
            )
            first_assigned_datetime = session.scalar(stmt)

            if first_assigned_datetime is None:
                return None
            else:
                first_assigned_date = first_assigned_datetime.date()
                days_difference = date.today() - first_assigned_date
                return days_difference.days

    @staticmethod
    def is_schedule_assigned(
        db_session: Session, user_id: UUID, schedule_id: UUID
    ) -> bool:
        """
        Check if schedule assigned for a specific user.

        Parameters
        ----------
        db_session : Session
            The database session.
        user_id: UUID
            ID of a user.
        schedule_id : UUID
            ID of a schedule.

        Returns
        -------
        bool
            `True` if assigned, otherwise `False`.
        """
        with db_session as session:
            stmt = select(DailySchedule.created_at).filter(
                and_(
                    DailySchedule.schedule_id == schedule_id,
                    DailySchedule.assignee_id == user_id,
                )
            )
            assigned = session.scalar(stmt)

            if assigned is None:
                return False
            else:
                return True

    def update(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        obj_in: DailyScheduleUpdate | dict[str, Any],
    ) -> DailySchedule:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            task_obj: DailySchedule = session.scalar(
                select(DailySchedule).where(DailySchedule.id == obj_id)
            )
            obj_data = jsonable_encoder(task_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data and isinstance(update_data[field], Enum):
                    setattr(task_obj, field, update_data[field].value)

                    # Set start date
                    if (
                        field == "status"
                        and update_data[field] == TaskStatus.IN_PROGRESS
                        and task_obj.start_date is None
                    ):
                        setattr(task_obj, "start_date", datetime.now())

                    # Set completion date
                    if (
                        field == "status"
                        and update_data[field] == TaskStatus.DONE
                        and task_obj.completion_date is None
                    ):
                        setattr(task_obj, "completion_date", datetime.now())
                elif field in update_data:
                    setattr(task_obj, field, update_data[field])

            session.commit()
            session.refresh(task_obj)

            return task_obj

    def restore(
        self,
        db_session: Session,
        *,
        db_obj: DailySchedule,
    ) -> DailySchedule:
        """
        Restore a record in the database.

        Parameters
        ----------
        db_session : Session
            Database session
        db_obj : ModelType
            Database model object

        Returns
        -------
        ModelType
            Returns updated record.
        """
        is_removed(db_obj)

        obj_in = dict(is_removed=False)

        db_obj = self.update(db_session=db_session, obj_id=db_obj.id, obj_in=obj_in)

        return db_obj


daily_schedule = CRUDDailySchedule(DailySchedule)
