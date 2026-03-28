#!/usr/bin/env python

"""Routes for the Lead Tasks module"""

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
from app.models import LeadTask
from app.schemas import LeadTaskCreateDB
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import LeadSqlStmtGenerator
from app.utils.user_task import validate_assignee

router = APIRouter()

permissions = Permissions(Modules.LEAD_TASK.value)
crud_util = CrudUtil(crud.lead_task)
read_params = CommonReadParams(UserTaskSearch, UserTaskSort)
stmt_gen = LeadSqlStmtGenerator(LeadTask)


@router.get(
    "/{lead_id}/tasks",
    summary="Read Lead Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.LeadTask],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_tasks(
    *,
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = UserTaskSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all leads"""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)
    if isinstance(filters_stmt, list):
        filters_stmt.append(getattr(LeadTask, "lead_id") == lead_id)
    else:
        filters_stmt = [getattr(LeadTask, "lead_id") == lead_id]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    tasks_list = crud.lead_task.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list


@router.get(
    "/tasks/{task_id}",
    summary="Read Lead Task By Id",
    response_description="Task data",
    response_model=schemas.LeadTask,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_task_by_id(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a lead task by an id"""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    return task


@router.post(
    "/{lead_id}/tasks",
    summary="Create Lead Task",
    response_description="Lead task created",
    response_model=schemas.LeadTask,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_lead_task(
    lead_id: Annotated[UUID, Path(description="The lead id")],
    task_in: schemas.LeadTaskCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new lead task."""

    UserContext.set(current_user.id)

    object_in = LeadTaskCreateDB(
        **task_in.__dict__,
        status=TaskStatus.TODO,
        assignee_id=current_user.id,
        lead_id=lead_id,
    )

    lead_task = crud.lead_task.create(db_session, obj_in=object_in)

    return lead_task


@router.put(
    "/tasks/{task_id}",
    summary="Update Lead Task",
    response_description="Updated task data",
    response_model=schemas.LeadTask,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    task_in: schemas.LeadTaskUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a lead task via an ID"""

    UserContext.set(current_user.id)

    # Get a lead task or raise an exception
    lead_task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=lead_task,
        exception_msg="This task does not belong to you.",
    )

    lead_task = crud.lead_task.update(db_session, obj_id=lead_task.id, obj_in=task_in)

    return lead_task


@router.delete(
    "/tasks/{task_id}",
    summary="Remove Lead Task",
    response_description="Task removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a lead task by providing an ID"""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=task,
        exception_msg="This task does not belong to you.",
    )

    crud.lead_task.remove(db_session, obj_id=task_id)

    return {"msg": "Lead task deleted successfully."}
