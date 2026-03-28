#!/usr/bin/env python

"""Celery tasks related to the Daily Schedule Module"""

from pydantic import EmailStr
from sqlalchemy.orm import Session

from app import crud
from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.schemas import DailyScheduleCreateDB


@celery_app.task()
def daily_schedule() -> str:
    """
    Periodic daily scheduling task to assign task/s to different users
    as per their today schedule.

    Returns
    -------
    str
        Task execution complete message.
    """
    from app.utils.task import DailySchedule

    user_daily_schedule = DailySchedule(logger=celery_log)
    return user_daily_schedule.run()


@celery_app.task()
def add_task_to_daily_schedule(obj_in: DailyScheduleCreateDB, email: EmailStr) -> str:
    """
    Assign today schedule task to a user.

    Parameters
    ----------
    obj_in : DailyScheduleCreateDB
        Daily schedule create schema object.
    email : EmailStr
        User email address.

    Returns
    -------
    str
        Task execution complete message.
    """
    db_session: Session = SessionLocal()

    celery_log.info(f"Assigning tasks to {email}")

    crud.daily_schedule.create(db_session, obj_in=obj_in)

    return f"Task assigned successfully to {email}"
