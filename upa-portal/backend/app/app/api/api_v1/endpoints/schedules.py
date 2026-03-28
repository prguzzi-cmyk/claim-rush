#!/usr/bin/env python

"""Routes for the schedules module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.models import User
from app.utils.contexts import UserContext
from app.utils.pagination import CustomPage
from app.utils.schedule import get_schedule_or_raise_exception

router = APIRouter()

permissions = Permissions(Modules.SCHEDULE.value)


@router.get(
    "",
    summary="Read Schedules",
    response_description="A list of schedules",
    response_model=CustomPage[schemas.Schedule],
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def read_schedules(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all schedules"""

    schedules_list = crud.schedule.get_multi(db_session)

    return schedules_list


@router.get(
    "/{schedule_id}",
    summary="Read Schedule By Id",
    response_description="Schedule data",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def read_schedule_by_id(
    schedule_id: Annotated[UUID, Path(description="The schedule id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a schedule by an id"""

    # Get a schedule or raise an exception
    schedule = get_schedule_or_raise_exception(db_session, schedule_id=schedule_id)

    return schedule


@router.post(
    "",
    summary="Create Schedule",
    response_description="Schedule created",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_schedule(
    schedule_in: schemas.ScheduleCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new schedule"""

    UserContext.set(current_user.id)

    schedule = crud.schedule.create(db_session, obj_in=schedule_in)

    return schedule


@router.post(
    "/{schedule_id}/task",
    summary="Append Schedule Tasks",
    response_description="Schedule updated",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
)
def append_schedule_tasks(
    schedule_id: Annotated[UUID, Path(description="The schedule id")],
    tasks: schemas.ScheduleTasksAppend,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Append a list of tasks to the schedule"""

    # Get a schedule or raise an exception
    schedule = get_schedule_or_raise_exception(db_session, schedule_id=schedule_id)

    schedule = crud.schedule.append_tasks(
        db_session, schedule_obj=schedule, tasks=tasks
    )

    return schedule


@router.put(
    "/{schedule_id}",
    summary="Update Schedule",
    response_description="Updated schedule data",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_schedule(
    schedule_id: Annotated[UUID, Path(description="The schedule id")],
    schedule_in: schemas.ScheduleUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a schedule via an ID"""

    UserContext.set(current_user.id)

    # Get a schedule or raise an exception
    get_schedule_or_raise_exception(db_session, schedule_id=schedule_id)

    schedule = crud.schedule.update(
        db_session, schedule_id=schedule_id, obj_in=schedule_in
    )

    return schedule


@router.delete(
    "/{schedule_id}",
    summary="Remove Schedule",
    response_description="Schedule removed",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_schedule(
    schedule_id: Annotated[UUID, Path(description="The schedule id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a schedule by providing an ID"""

    # Get a schedule or raise an exception
    get_schedule_or_raise_exception(db_session, schedule_id=schedule_id)

    schedule = crud.schedule.remove(db_session, obj_id=schedule_id)

    return schedule


@router.delete(
    "/{schedule_id}/task",
    summary="Remove Schedule Tasks",
    response_description="Schedule updated",
    response_model=schemas.Schedule,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_schedule_tasks(
    schedule_id: Annotated[UUID, Path(description="The schedule id")],
    tasks: schemas.ScheduleTasksRemove,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove tasks from a schedule by providing a UUID of task"""

    # Get a schedule or raise an exception
    schedule = get_schedule_or_raise_exception(db_session, schedule_id=schedule_id)

    schedule = crud.schedule.remove_tasks(
        db_session, schedule_obj=schedule, tasks=tasks
    )

    return schedule
