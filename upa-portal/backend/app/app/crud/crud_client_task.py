#!/usr/bin/env python

"""CRUD operations for the client task model"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import TaskStatus
from app.crud.base import CRUDBase
from app.models import ClientTask
from app.schemas import ClientTaskCreateDB, ClientTaskUpdate


class CRUDClientTask(CRUDBase[ClientTask, ClientTaskCreateDB, ClientTaskUpdate]):
    def update(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        obj_in: ClientTaskUpdate | dict[str, Any]
    ) -> ClientTask:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            task_obj: ClientTask = session.scalars(
                select(ClientTask).where(ClientTask.id == obj_id)
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


client_task = CRUDClientTask(ClientTask)
