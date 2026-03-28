#!/usr/bin/env python

"""Routes for the Client Tasks module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.enums import TaskStatus
from app.core.rbac import Modules
from app.core.read_params_attrs import Ordering, UserTaskSearch, UserTaskSort
from app.models import ClientTask
from app.schemas import ClientTaskCreateDB
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClientSqlStmtGenerator
from app.utils.user_task import validate_assignee

router = APIRouter()

permissions = Permissions(Modules.CLIENT_TASK.value)
crud_util = CrudUtil(crud.client_task)
read_params = CommonReadParams(UserTaskSearch, UserTaskSort)
stmt_gen = ClientSqlStmtGenerator(ClientTask)


@router.get(
    "/{client_id}/tasks",
    summary="Read Client Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.ClientTask],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_tasks(
    *,
    client_id: Annotated[UUID, Path(description="The client ID.")],
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = UserTaskSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all clients."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)
    if isinstance(filters_stmt, list):
        filters_stmt.append(getattr(ClientTask, "client_id") == client_id)
    else:
        filters_stmt = [getattr(ClientTask, "client_id") == client_id]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    tasks_list = crud.client_task.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list


@router.get(
    "/tasks/{task_id}",
    summary="Read Client Task By Id",
    response_description="Task data",
    response_model=schemas.ClientTask,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_task_by_id(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a client task by an id."""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    return task


@router.post(
    "/{client_id}/tasks",
    summary="Create Client Task",
    response_description="Client task created",
    response_model=schemas.ClientTask,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_client_task(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    task_in: schemas.ClientTaskCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new client task."""

    UserContext.set(current_user.id)

    object_in = ClientTaskCreateDB(
        **task_in.__dict__,
        status=TaskStatus.TODO,
        assignee_id=current_user.id,
        client_id=client_id,
    )

    client_task = crud.client_task.create(db_session, obj_in=object_in)

    return client_task


@router.put(
    "/tasks/{task_id}",
    summary="Update Client Task",
    response_description="Updated task data",
    response_model=schemas.ClientTask,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_client_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    task_in: schemas.ClientTaskUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a client task via an ID."""

    UserContext.set(current_user.id)

    # Get a client task or raise an exception
    client_task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=client_task,
        exception_msg="This task does not belong to you.",
    )

    client_task = crud.client_task.update(
        db_session, obj_id=client_task.id, obj_in=task_in
    )

    return client_task


@router.delete(
    "/tasks/{task_id}",
    summary="Remove Client Task",
    response_description="Task removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_client_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a client task by providing an ID."""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=task,
        exception_msg="This task does not belong to you.",
    )

    crud.client_task.remove(db_session, obj_id=task_id)

    return {"msg": "Client task deleted successfully."}
