#!/usr/bin/env python

"""Routes for the Claim Tasks module"""

from functools import partial
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.enums import ClaimActivityType, TaskStatus
from app.core.rbac import Modules, Operations
from app.core.read_params_attrs import Ordering, UserTaskSearch, UserTaskSort
from app.models import ClaimTask
from app.schemas import ClaimTaskCreateDB
from app.utils.claim import validate_claim_ownership, validate_claim_role
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClaimSqlStmtGenerator
from app.utils.user_task import validate_assignee

router = APIRouter()

module = Modules.CLAIM_TASK
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim_task)
crud_util_claim = CrudUtil(crud.claim)
read_params = CommonReadParams(UserTaskSearch, UserTaskSort)
stmt_gen = ClaimSqlStmtGenerator(ClaimTask)
resource_exc_msg = "You do not have permission to modify this claim task."


@router.get(
    "/{claim_id}/tasks",
    summary="Read Claim Tasks",
    response_description="A list of tasks",
    response_model=CustomPage[schemas.ClaimTask],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_tasks(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = UserTaskSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all claim tasks."""

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)
    if isinstance(filters_stmt, list):
        filters_stmt.append(getattr(ClaimTask, "claim_id") == claim_id)
    else:
        filters_stmt = [getattr(ClaimTask, "claim_id") == claim_id]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    tasks_list = crud.claim_task.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tasks_list


@router.get(
    "/tasks/{task_id}",
    summary="Read Claim Task By Id",
    response_description="Task data",
    response_model=schemas.ClaimTask,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_task_by_id(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim task by an id."""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=task.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    return task


@router.post(
    "/{claim_id}/tasks",
    summary="Create Claim Task",
    response_description="Claim task created",
    response_model=schemas.ClaimTask,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_claim_task(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    task_in: schemas.ClaimTaskCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new claim task."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.CREATE,
    )

    # Create a task record in the database
    object_in = ClaimTaskCreateDB(
        **task_in.__dict__,
        status=TaskStatus.PENDING,
        assignee_id=current_user.id,
        claim_id=claim_id,
    )
    claim_task = crud.claim_task.create(db_session, obj_in=object_in)

    # Log task creation activity
    crud.claim.create_activity(
        db_session,
        claim,
        ClaimActivityType.TASK_CREATED,
        extra_details=f'Task "{claim_task.title}" created',
    )

    return claim_task


@router.put(
    "/tasks/{task_id}",
    summary="Update Claim Task",
    response_description="Updated task data",
    response_model=schemas.ClaimTask,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    task_in: schemas.ClaimTaskUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim task via an ID."""

    UserContext.set(current_user.id)

    # Get a claim task or raise an exception
    claim_task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=claim_task,
        exception_msg="This task does not belong to you.",
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_task.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.UPDATE,
        resource=claim_task,
        resource_exc_msg=resource_exc_msg,
    )

    # Update a task record.
    claim_task = crud.claim_task.update(
        db_session, obj_id=claim_task.id, obj_in=task_in
    )

    return claim_task


@router.patch(
    "/tasks/{task_id}/restore",
    summary="Restore Claim Task",
    response_description="Restored Task data",
    response_model=schemas.ClaimTask,
    dependencies=[
        Depends(permissions.restore()),
    ],
)
def restore_claim_task(
    task_id: Annotated[UUID, Path(description="The claim task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Restore a claim task via an ID."""

    UserContext.set(current_user.id)

    # Get a claim task or raise an exception
    task = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=task_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=task.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.RESTORE,
        resource=task,
        resource_exc_msg=resource_exc_msg,
    )

    task = crud.claim_task.restore(db_session, db_obj=task)

    return task


@router.delete(
    "/tasks/{task_id}",
    summary="Remove Claim Task",
    response_description="Task removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim_task(
    task_id: Annotated[UUID, Path(description="The task ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim task by providing an ID."""

    # Get a task or raise an exception
    task = crud_util.get_object_or_raise_exception(db_session, object_id=task_id)

    # Validate task assignee
    validate_assignee(
        user=current_user,
        task_obj=task,
        exception_msg="This task does not belong to you.",
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=task.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.REMOVE,
        resource=task,
        resource_exc_msg=resource_exc_msg,
    )

    crud.claim_task.remove(db_session, obj_id=task_id)

    return {"msg": "Claim task deleted successfully."}
