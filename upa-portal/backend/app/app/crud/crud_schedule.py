#!/usr/bin/env python

"""CRUD operations for the schedule model"""

from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud
from app.crud.base import CRUDBase
from app.models import Schedule
from app.schemas import (
    ScheduleCreate,
    ScheduleTasksAppend,
    ScheduleTasksRemove,
    ScheduleUpdate,
)
from app.utils.exceptions import raise_if_unique_violation


class CRUDSchedule(CRUDBase[Schedule, ScheduleCreate, ScheduleUpdate]):
    @staticmethod
    def get_by_day_number(db_session: Session, *, day_number: int) -> Schedule | None:
        """
        Retrieve a single record by Schedule day number.

        Parameters
        ----------
        db_session : Session
            Database Session
        day_number : int
            Day number of a schedule

        Returns
        -------
        ModelType
            On success, returns the found record, or None if nothing is found.
        """
        with db_session as session:
            stmt = select(Schedule)
            stmt = stmt.where(
                and_(
                    Schedule.day_number == day_number,
                    Schedule.is_removed.is_(False),
                    Schedule.is_active.is_(True),
                )
            )

            return session.scalar(stmt)

    def create(self, db_session: Session, *, obj_in: ScheduleCreate) -> Schedule:
        try:
            tasks_obj = []

            if obj_in.tasks is not None:
                tasks_obj = crud.task.get_tasks_list_by_id(db_session, obj_in.tasks)

            with db_session as session:
                schedule_obj = Schedule(
                    title=obj_in.title,
                    goal=obj_in.goal,
                    day_number=obj_in.day_number,
                    is_active=obj_in.is_active,
                    can_be_removed=obj_in.can_be_removed,
                )

                schedule_obj.tasks.extend(tasks_obj)

                session.add(schedule_obj)
                session.commit()
                session.refresh(schedule_obj)

                return schedule_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A schedule with this day number already exists."
            )

            raise exc

    def update(
        self,
        db_session: Session,
        *,
        schedule_id: UUID,
        obj_in: ScheduleUpdate | dict[str, Any],
    ) -> Schedule:
        try:
            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)

            tasks_obj = []
            if obj_in.tasks is not None:
                tasks_obj = crud.task.get_tasks_list_by_id(db_session, obj_in.tasks)

            with db_session as session:
                sch_obj: Schedule = session.query(Schedule).get(schedule_id)
                obj_data = jsonable_encoder(sch_obj)

                # Set Model Schema attributes with the provided values
                for field in obj_data:
                    if field in update_data and field != "tasks":
                        setattr(sch_obj, field, update_data[field])

                if len(tasks_obj) > 0:
                    # Delete existing association records
                    sch_obj.tasks = []
                    session.commit()
                    session.refresh(sch_obj)

                    sch_obj.tasks.extend(tasks_obj)

                session.commit()
                session.refresh(sch_obj)

                return sch_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A schedule with this day number already exists."
            )

            raise exc

    @staticmethod
    def append_tasks(
        db_session: Session, *, schedule_obj: Schedule, tasks: ScheduleTasksAppend
    ) -> Schedule:
        """
        Append tasks to a schedule.

        Parameters
        ----------
        db_session : Session
            Database session.
        schedule_obj : Schedule
            The schedule model object.
        tasks : ScheduleTasksAppend
            A list consist of Tasks UUID.

        Returns
        -------
        Schedule
            Updated schedule model object.
        """
        tasks_obj = []

        if tasks is not None:
            tasks_obj = crud.task.get_tasks_list_by_id(db_session, tasks.tasks)

        with db_session as session:
            for task in tasks_obj:
                if task not in schedule_obj.tasks:
                    schedule_obj.tasks.append(task)

                session.add(schedule_obj)
                session.commit()
                session.refresh(schedule_obj)

            return schedule_obj

    @staticmethod
    def remove_tasks(
        db_session: Session, *, schedule_obj: Schedule, tasks: ScheduleTasksRemove
    ) -> Schedule:
        """
        Remove tasks from a schedule.

        Parameters
        ----------
        db_session : Session
            Database session.
        schedule_obj : Schedule
            The schedule model object.
        tasks : ScheduleTasksRemove
            A list consist of Tasks UUID.

        Returns
        -------
        Schedule
            Updated schedule model object.
        """
        tasks_obj = []
        if tasks is not None:
            tasks_obj = crud.task.get_tasks_list_by_id(db_session, tasks.tasks)

        with db_session as session:
            for task in tasks_obj:
                if task in schedule_obj.tasks:
                    schedule_obj.tasks.remove(task)

            session.add(schedule_obj)
            session.commit()
            session.refresh(schedule_obj)

            return schedule_obj


schedule = CRUDSchedule(Schedule)
