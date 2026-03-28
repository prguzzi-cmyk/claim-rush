#!/usr/bin/env python

"""CRUD operations for the user task model"""

from datetime import datetime
from enum import Enum
from typing import Any, Sequence
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, with_polymorphic

from app.core.enums import TaskModule, TaskStatus
from app.crud.base import CRUDBase
from app.models import ClaimTask, ClientTask, LeadTask, UserTask
from app.schemas import UserTaskCreateDB, UserTaskUpdate


class CRUDUserTask(CRUDBase[UserTask, UserTaskCreateDB, UserTaskUpdate]):
    @staticmethod
    def get_multi_tasks(
        db_session: Session,
        task_module: TaskModule = TaskModule.ALL,
        removed: bool = False,
        filters: list = None,
        order_by: list = None,
    ) -> Sequence[UserTask] | None:
        """
        Get a list of combined module user tasks.

        Parameters
        ----------
        db_session : Session
            Database session
        task_module: TaskModule
            Type of Task Module
        removed : bool
            Fetch only removed records
        filters : list
            A list consists of filters
        order_by : list
            A list consists of order by columns

        Returns
        -------
        Sequence[UserTask] | None
            On success, return a list of UserTask objects. None if nothing is found.
        """
        with db_session as session:
            match task_module:
                case TaskModule.LEAD:
                    user_task_poly = LeadTask
                case TaskModule.CLIENT:
                    user_task_poly = ClientTask
                case TaskModule.CLAIM:
                    user_task_poly = ClaimTask
                case TaskModule.USER:
                    user_task_poly = UserTask
                    filters.append(UserTask.type == TaskModule.USER.value)
                case _:
                    user_task_poly = with_polymorphic(UserTask, "*")

            stmt = select(user_task_poly)

            # Removed records query
            stmt = stmt.where(user_task_poly.is_removed.is_(removed))

            # Apply filters
            if filters:
                stmt = stmt.filter(and_(*filters))

            # Apply ordering
            if order_by:
                stmt = stmt.order_by(*order_by)
            else:
                stmt = stmt.order_by(user_task_poly.created_at)

            return paginate(session, stmt)

    def create(self, db_session: Session, *, obj_in: UserTaskCreateDB) -> UserTask:
        with db_session as session:
            user_task_obj = UserTask(
                title=obj_in.title,
                description=obj_in.description,
                due_date=obj_in.due_date,
                priority=obj_in.priority.value,
                status=obj_in.status.value,
                is_active=obj_in.is_active,
                assignee_id=obj_in.assignee_id,
            )

            session.add(user_task_obj)
            session.commit()
            session.refresh(user_task_obj)

            return user_task_obj

    def update(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        obj_in: UserTaskUpdate | dict[str, Any],
    ) -> UserTask:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            task_obj: UserTask = session.scalars(
                select(UserTask).where(UserTask.id == obj_id)
            ).first()
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


user_task = CRUDUserTask(UserTask)
