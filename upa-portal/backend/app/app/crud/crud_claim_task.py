#!/usr/bin/env python

"""CRUD operations for the claim task model"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app import crud
from app.core.enums import ClaimActivityType, TaskStatus
from app.core.security import is_removed
from app.crud.base import CRUDBase
from app.models import ClaimTask
from app.schemas import ClaimTaskCreateDB, ClaimTaskUpdate


class CRUDClaimTask(CRUDBase[ClaimTask, ClaimTaskCreateDB, ClaimTaskUpdate]):
    def update(
        self,
        db_session: Session,
        *,
        obj_id: UUID,
        obj_in: ClaimTaskUpdate | dict[str, Any],
    ) -> ClaimTask:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        with db_session as session:
            task_obj: ClaimTask = session.scalar(
                select(ClaimTask).where(ClaimTask.id == obj_id)
            )
            obj_data = jsonable_encoder(task_obj)

            # Capture previous values for activity tracking
            previous_status = task_obj.status
            previous_assignee = task_obj.assignee_id
            claim_id = task_obj.claim_id
            task_title = task_obj.title

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
                        and update_data[field] in (TaskStatus.DONE, TaskStatus.COMPLETED)
                        and task_obj.completion_date is None
                    ):
                        setattr(task_obj, "completion_date", datetime.now())
                elif field in update_data:
                    setattr(task_obj, field, update_data[field])

            new_status = task_obj.status
            new_assignee = task_obj.assignee_id

            session.commit()
            session.refresh(task_obj)

        # Create activity entries — re-fetch claim in a fresh session
        status_changed = new_status != previous_status
        assignee_changed = new_assignee != previous_assignee

        if status_changed or assignee_changed:
            from app.models import Claim

            with db_session as session:
                claim_obj = session.scalar(
                    select(Claim).where(Claim.id == claim_id)
                )

                if status_changed:
                    if new_status == TaskStatus.COMPLETED.value:
                        crud.claim.create_activity(
                            db_session,
                            claim_obj,
                            ClaimActivityType.TASK_COMPLETED,
                            extra_details=f'Task "{task_title}" completed',
                        )
                    else:
                        crud.claim.create_activity(
                            db_session,
                            claim_obj,
                            ClaimActivityType.TASK_STATUS_CHANGED,
                            extra_details=f'Task "{task_title}" status changed from {previous_status} to {new_status}',
                        )

                if assignee_changed:
                    crud.claim.create_activity(
                        db_session,
                        claim_obj,
                        ClaimActivityType.TASK_ASSIGNED,
                        extra_details=f'Task "{task_title}" was reassigned',
                    )

        # Re-query with fresh session so the object is bound for serialization
        with db_session as session:
            task_obj = session.scalar(
                select(ClaimTask).where(ClaimTask.id == obj_id)
            )
            return task_obj

    def restore(
        self,
        db_session: Session,
        *,
        db_obj: ClaimTask,
    ) -> ClaimTask:
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


claim_task = CRUDClaimTask(ClaimTask)
