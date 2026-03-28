#!/usr/bin/env python

"""Tasks related utility functions"""

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from celery import group
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models
from app.core.enums import Priority, TaskStatus
from app.db.session import SessionLocal
from app.models import Schedule, Task, User
from app.schemas import DailyScheduleCreateDB
from app.tasks import add_task_to_daily_schedule
from app.utils.contexts import UserContext


def get_task_or_raise_exception(db_session: Session, task_id: UUID) -> models.Task:
    """
    Get a task or raise an exception.

    Parameters
    ----------
    db_session : Session
        Database session
    task_id : UUID
        Task id

    Returns
    -------
    Task
        If task found then it will return Task object.
    """
    task = crud.task.get(db_session, obj_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The task with this id does not exist in the system.",
        )

    return task


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


class DailySchedule:
    def __init__(self, logger: Any):
        self.logger = logger

    def run(self) -> str:
        """
        Starts execution of the Daily Schedule assignment for the eligible users.

        Returns
        -------
        str
            Job execution message.
        """
        db_session: Session = SessionLocal()

        self.logger.info("Started fetching users.")
        users = crud.user.get_active_users(db_session)
        self.logger.info("Completed fetching users.")

        for user in users:
            UserContext.set(user.id)

            self.logger.info(f"Getting today's schedule for {user.email}")
            today_schedule = self.get_user_today_schedule(db_session, user)

            if today_schedule is not None:
                self.logger.info(f"Getting tasks for {user.email}")
                tasks: list[Task] = crud.task.get_tasks_list_by_id(
                    db_session, today_schedule.tasks
                )

                self.logger.info(f"Assigning tasks to {user.email}")
                self.assign_tasks(tasks, today_schedule, user)
            else:
                self.logger.info(f"No schedule or tasks for {user.email}")

        return "Daily scheduling job executed successfully."

    @staticmethod
    def get_user_today_schedule(db_session: Session, user: User) -> Schedule | None:
        """
        Get the current day schedule for a particular user.

        Parameters
        ----------
        db_session : Session
            Database session.
        user : User
            The User model object.

        Returns
        -------
        Schedule:
            Schedule object if found, otherwise None.
        """
        scheduled_days = crud.daily_schedule.count_scheduled_days(
            db_session, user_id=user.id
        )

        if scheduled_days is None:
            today_schedule = crud.schedule.get_by_day_number(db_session, day_number=1)
        else:
            today_schedule = crud.schedule.get_by_day_number(
                db_session, day_number=scheduled_days + 1
            )

        if today_schedule and today_schedule.tasks:
            schedule_assigned = crud.daily_schedule.is_schedule_assigned(
                db_session, user_id=user.id, schedule_id=today_schedule.id
            )

            if not schedule_assigned:
                return today_schedule

        return None

    @staticmethod
    def assign_tasks(tasks: list[Task], today_schedule: Schedule, user: User) -> None:
        """
        Execute parallel task assigning jobs for a user.

        Parameters
        ----------
        tasks : list[Task]
            A list of tasks.
        today_schedule : Schedule
            The current day schedule.
        user : User
            The user model object.
        """
        daily_schedule_tasks = []

        for task in tasks:
            task_in = DailyScheduleCreateDB(
                title=task.title,
                description=task.description,
                due_date=date.today() + timedelta(hours=task.estimated_duration),
                priority=Priority.HIGH,
                status=TaskStatus.TODO,
                assignee_id=user.id,
                schedule_id=today_schedule.id,
            )

            daily_schedule_tasks.append(
                add_task_to_daily_schedule.s(task_in, user.email)
            )

        if daily_schedule_tasks:
            job = group(daily_schedule_tasks)
            job.apply_async()
