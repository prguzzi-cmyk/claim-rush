#!/usr/bin/env python

"""CRUD operations for the task_meta model"""

from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TaskMeta
from app.schemas import TaskMetaCreate, TaskMetaUpdate


class CRUDTaskMeta:
    @staticmethod
    def get(db_session: Session, *, obj_id: UUID) -> TaskMeta | None:
        """
        Retrieve a single record by ID

        Parameters
        ----------
        db_session : Session
            Database Session
        obj_id : UUID
            ID of an object

        Returns
        -------
        ModelType
            On success, returns the found record, or None if nothing is found.
        """
        with db_session as session:
            stmt = select(TaskMeta).where(TaskMeta.id == obj_id)
            return session.scalars(stmt).first()

    @staticmethod
    def create(
        db_session: Session, *, task_obj: Task, obj_in: TaskMetaCreate
    ) -> TaskMeta:
        with db_session as session:
            task_meta_obj = TaskMeta(
                key=obj_in.key,
                content=obj_in.content,
            )

            task_meta_obj.task = task_obj

            session.add(task_meta_obj)
            session.commit()
            session.refresh(task_meta_obj)

            return task_meta_obj

    @staticmethod
    def update(
        db_session: Session,
        *,
        db_obj: TaskMeta,
        obj_in: TaskMetaUpdate | dict[str, Any]
    ) -> TaskMeta:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            obj_data = jsonable_encoder(db_obj)

            # Set Model Schema attributes with the provided values
            for field in obj_data:
                if field in update_data:
                    setattr(db_obj, field, update_data[field])

            session.add(db_obj)
            session.commit()
            session.refresh(db_obj)

        return db_obj

    @staticmethod
    def remove(db_session: Session, *, meta_obj: TaskMeta) -> dict[str, str]:
        """
        Delete a record in the database.

        Parameters
        ----------
        db_session : Session
            Database Session
        meta_obj : TaskMeta
            ID of the object to delete

        Returns
        -------
        str
            Returns the deleted object, or None if not found.
        """
        with db_session as session:
            session.delete(meta_obj)
            session.commit()

        return {"msg": "Task meta removed successfully."}


task_meta = CRUDTaskMeta()
