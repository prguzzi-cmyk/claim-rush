#!/usr/bin/env python

"""CRUD operations for the task model"""

from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import Task, TaskMeta
from app.schemas import TaskCreate, TaskUpdate
from app.utils.exceptions import exc_not_found, raise_if_unique_violation


class CRUDTask(CRUDBase[Task, TaskCreate, TaskUpdate]):
    def get_tasks_list_by_id(self, db_session: Session, tasks: list) -> list[Task]:
        """
        Get a list of tasks objects.

        Parameters
        ----------
        db_session : Session
            Database session.
        tasks : list
            A list consist of tasks ids.

        Returns
        -------
        list
            A list of tasks objects.
        """
        tasks_obj = []

        with db_session as session:
            for task_ob in tasks:
                if isinstance(task_ob, UUID):
                    task_id = task_ob
                else:
                    task_id = task_ob.id

                task_obj = self.get(session, obj_id=task_id)
                if task_obj is None:
                    exc_not_found(f"Task with this id ({task_id}) not found.")

                tasks_obj.append(task_obj)

        return tasks_obj

    def create(self, db_session: Session, *, obj_in: TaskCreate) -> Task:
        try:
            with db_session as session:
                task_obj = Task(
                    title=obj_in.title,
                    description=obj_in.description,
                    is_active=obj_in.is_active,
                    estimated_duration=obj_in.estimated_duration,
                    can_be_removed=obj_in.can_be_removed,
                )

                if hasattr(obj_in, "task_meta"):
                    task_meta_objs = []
                    for task_meta in obj_in.task_meta:
                        task_meta_obj = TaskMeta(
                            key=task_meta.key,
                            content=task_meta.content,
                        )
                        task_meta_obj.task = task_obj

                        task_meta_objs.append(task_meta_obj)

                task_obj.task_meta = task_meta_objs

                session.add(task_obj)
                session.add_all(task_meta_objs)
                session.commit()
                session.refresh(task_obj)

                return task_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A task with this title already exists."
            )

            raise exc

    def update(
        self, db_session: Session, *, db_obj: Task, obj_in: TaskUpdate | dict[str, Any]
    ) -> Task:
        try:
            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.dict(exclude_unset=True)

            with db_session as session:
                obj_data = jsonable_encoder(db_obj)

                # Set Model Schema attributes with the provided values
                for field in obj_data:
                    if field in update_data and field != "task_meta":
                        setattr(db_obj, field, update_data[field])

                if obj_in.task_meta is not None:
                    # Delete existing meta records
                    for task_meta in db_obj.task_meta:
                        session.delete(task_meta)

                    # Add new meta records
                    for task_meta in obj_in.task_meta:
                        task_meta_obj = TaskMeta(
                            key=task_meta.key,
                            content=task_meta.content,
                        )
                        db_obj.task_meta.append(task_meta_obj)

                session.add(db_obj)
                session.commit()
                session.refresh(db_obj)

            return db_obj
        except IntegrityError as exc:
            raise_if_unique_violation(
                exc=exc, msg="A task with this title already exists."
            )

            raise exc


task = CRUDTask(Task)
