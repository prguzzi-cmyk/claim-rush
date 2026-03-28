#!/usr/bin/env python

"""Schedules related utility functions"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models


def get_schedule_or_raise_exception(
    db_session: Session, schedule_id: UUID
) -> models.Schedule:
    """
    Get a schedule or raise an exception.

    Parameters
    ----------
    db_session : Session
        Database session
    schedule_id : UUID
        Schedule id

    Returns
    -------
    Schedule
        If schedule found then it will return Schedule object.
    """
    schedule = crud.schedule.get(db_session, obj_id=schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The schedule with this id does not exist in the system.",
        )

    return schedule


def get_task_meta_or_raise_exception(
    db_session: Session, meta_id: UUID
) -> models.TaskMeta:
    """
    Get a Task Meta or raise an exception.

    Parameters
    ----------
    db_session : Session
        Database session
    meta_id : UUID
        Meta id

    Returns
    -------
    TaskMeta
        If meta found then it will return TaskMeta object.
    """
    meta = crud.task_meta.get(db_session, obj_id=meta_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task meta with this id does not exist in the system",
        )

    return meta
