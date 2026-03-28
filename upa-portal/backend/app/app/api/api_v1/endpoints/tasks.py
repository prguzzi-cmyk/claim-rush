#!/usr/bin/env python

"""Routes for the tasks module"""

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
from app.utils.task import get_task_meta_or_raise_exception, get_task_or_raise_exception

router = APIRouter()

permissions = Permissions(Modules.TASK.value)


@router.get(
    "",
    summary="Read Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.Task],
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def read_tasks(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all tasks"""

    tasks_list = crud.task.get_multi(db_session)

    return tasks_list


@router.get(
    "/{task_id}",
    summary="Read Task By Id",
    response_description="Task data",
    response_model=schemas.Task,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def read_task_by_id(
    task_id: Annotated[UUID, Path(description="The task id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a task by an id"""

    # Get a task or raise an exception
    task = get_task_or_raise_exception(db_session, task_id=task_id)

    return task


@router.post(
    "",
    summary="Create Task",
    response_description="Task created",
    response_model=schemas.Task,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task_in: schemas.TaskCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new task"""

    UserContext.set(current_user.id)

    task = crud.task.create(db_session, obj_in=task_in)

    return task


@router.put(
    "/{task_id}",
    summary="Update Task",
    response_description="Updated task data",
    response_model=schemas.Task,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_task(
    task_id: Annotated[UUID, Path(description="The task id")],
    task_in: schemas.TaskUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a task via an ID"""

    UserContext.set(current_user.id)

    # Get a task or raise an exception
    task = get_task_or_raise_exception(db_session, task_id=task_id)

    task = crud.task.update(db_session, db_obj=task, obj_in=task_in)

    return task


@router.post(
    "/{task_id}/meta",
    summary="Create Task Meta",
    response_description="Task Meta created",
    response_model=schemas.TaskMeta,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_task_meta(
    task_id: Annotated[UUID, Path(description="The task id")],
    meta_in: schemas.TaskMetaCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Create a new task meta"""

    # Get a task or raise an exception
    task = get_task_or_raise_exception(db_session, task_id=task_id)

    meta = crud.task_meta.create(db_session, task_obj=task, obj_in=meta_in)

    return meta


@router.put(
    "/meta/{meta_id}",
    summary="Update Task Meta",
    response_description="Updated task meta data",
    response_model=schemas.TaskMeta,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_task_meta(
    meta_id: Annotated[UUID, Path(description="The meta id")],
    meta_in: schemas.TaskMetaUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Update a task meta via an ID"""

    # Get a Task Meta or raise an exception
    meta = get_task_meta_or_raise_exception(db_session, meta_id=meta_id)

    meta = crud.task_meta.update(db_session, db_obj=meta, obj_in=meta_in)

    return meta


@router.delete(
    "/{task_id}",
    summary="Remove Task",
    response_description="Task removed",
    response_model=schemas.Task,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_task(
    task_id: Annotated[UUID, Path(description="The task id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a task by providing an ID"""

    # Get a task or raise an exception
    get_task_or_raise_exception(db_session, task_id=task_id)

    task = crud.task.remove(db_session, obj_id=task_id)

    return task


@router.delete(
    "/meta/{meta_id}",
    summary="Remove Task Meta",
    response_description="Task Meta removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_task_meta(
    meta_id: Annotated[UUID, Path(description="The meta id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a task meta by providing an ID"""

    # Get a Task meta or raise an exception
    meta = get_task_meta_or_raise_exception(db_session, meta_id=meta_id)

    meta = crud.task_meta.remove(db_session, meta_obj=meta)

    return meta
