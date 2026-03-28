#!/usr/bin/env python

"""Routes for the User Task module"""

from typing import Annotated, Any, Union
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.enums import TaskModule, TaskStatus
from app.core.rbac import Modules
from app.core.read_params_attrs import Ordering, UserTaskSearch, UserTaskSort
from app.models import UserTask
from app.schemas import UserTaskCreateDB
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator
from app.utils.user_task import validate_assignee

router = APIRouter()

permissions = Permissions(Modules.USER_TASK.value)
crud_util_user = CrudUtil(crud.user)
crud_util = CrudUtil(crud.user_task)
stmt_gen = SqlStmtGenerator(UserTask)
read_params = CommonReadParams(UserTaskSearch, UserTaskSort)


@router.get(
    "/{user_id}/tasks",
    summary="Read User Tasks",
    response_description="Tasks data",
    response_model=CustomPage[
        Union[
            schemas.LeadTask,
            schemas.ClientTask,
            schemas.ClaimTask,
            schemas.DailySchedule,
            schemas.UserTask,
        ]
    ],
    dependencies=[Depends(permissions.read())],
)
def read_user_tasks(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = UserTaskSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    task_module: Annotated[
        TaskModule, Query(description="Type of task module.")
    ] = TaskModule.ALL,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Retrieve a list of user tasks."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)
    if not crud.user.has_admin_privileges(current_user):
        if isinstance(filters_stmt, list):
            filters_stmt.append(getattr(UserTask, "assignee_id") == current_user.id)
        else:
            filters_stmt = [getattr(UserTask, "assignee_id") == current_user.id]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    user_tasks = crud.user_task.get_multi_tasks(
        db_session,
        task_module=task_module,
        removed=removed.only_removed,
        filters=filters_stmt,
        order_by=orderby_stmt,
    )

    return user_tasks


@router.post(
    "/tasks",
    summary="Create User Task",
    response_description="User task created",
    response_model=schemas.UserTask,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_user_task(
    user_task_in: schemas.UserTaskCreate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Create a new user task."""

    UserContext.set(current_user.id)

    object_in = UserTaskCreateDB(
        **user_task_in.__dict__,
        status=TaskStatus.TODO,
        assignee_id=current_user.id,
    )
    user_task = crud.user_task.create(db_session, obj_in=object_in)

    return user_task


@router.get(
    "/tasks/{task_id}",
    summary="Read User Task By Id",
    response_description="Task data",
    response_model=schemas.UserTask,
    dependencies=[Depends(permissions.read())],
)
def read_user_task_by_id(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Get a specific user task by id"""

    # Get a task or raise an exception
    user_task: UserTask = crud_util.get_object_or_raise_exception(
        db_session, object_id=task_id
    )

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=user_task,
        exception_msg="This task does not belong to you.",
    )

    return user_task


@router.put(
    "/tasks/{task_id}",
    summary="Update User Task",
    response_description="Updated task data",
    response_model=schemas.UserTask,
    dependencies=[Depends(permissions.update())],
)
def update_user_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    task_in: schemas.UserTaskUpdate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Update a user task with an ID"""

    UserContext.set(current_user.id)

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=task,
        exception_msg="This task does not belong to you.",
    )

    user_task = crud.user_task.update(db_session, obj_id=task_id, obj_in=task_in)

    return user_task


@router.delete(
    "/tasks/{task_id}",
    summary="Remove User Task",
    response_description="Task removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def remove_user_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Remove a user task by providing an ID"""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=task,
        exception_msg="This task does not belong to you.",
    )

    crud.user_task.remove(db_session, obj_id=task_id)

    return {"msg": "User task deleted successfully."}
