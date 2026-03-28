#!/usr/bin/env python

"""Routes for the User Policy module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions, at_least_admin_user
from app.api.deps.app import CommonReadParams
from app.core.rbac import Modules
from app.core.read_params_attrs import Ordering, UserPolicySearch, UserPolicySort
from app.models import UserPolicy
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.USER_POLICY.value)
crud_util_user = CrudUtil(crud.user)
crud_util = CrudUtil(crud.user_policy)
stmt_gen = SqlStmtGenerator(UserPolicy)
read_params = CommonReadParams(UserPolicySearch, UserPolicySort)


@router.get(
    "/policies/listing",
    summary="Read User Policies",
    response_description="Policies data",
    response_model=CustomPage[schemas.UserPolicy],
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_user_policies(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = UserPolicySort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Retrieve a list of user policies."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    user_policies = crud.user_policy.get_multi(
        db_session,
        filters=filters_stmt,
        order_by=orderby_stmt,
    )

    return user_policies


@router.post(
    "/{user_id}/policies",
    summary="Create User Policy",
    response_description="User policy created",
    response_model=schemas.UserPolicy,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_user_policy(
    user_id: Annotated[UUID, Path(description="The user ID.")],
    permissions_in: schemas.UserPolicyCreate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Create a new user policy."""

    UserContext.set(current_user.id)

    crud_util_user.get_object_or_raise_exception(
        db_session,
        user_id,
        err_msg="The user with this id does not exist in the system.",
    )

    user_policy = crud.user_policy.create(
        db_session,
        obj_in=schemas.UserPolicyCreateInDB(
            user_id=user_id, permissions=permissions_in.permissions
        ),
    )

    return user_policy


@router.get(
    "/policies/{policy_id}",
    summary="Read User Policy By Id",
    response_description="Policy data",
    response_model=schemas.UserPolicy,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_user_policy_by_id(
    policy_id: Annotated[UUID, Path(description="The policy ID.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Get a specific user policy by id"""

    # Get a policy or raise an exception
    user_policy: UserPolicy = crud_util.get_object_or_raise_exception(
        db_session, object_id=policy_id
    )

    return user_policy


@router.put(
    "/policies/{policy_id}",
    summary="Update User Policy",
    response_description="Updated policy data",
    response_model=schemas.UserPolicy,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.update())],
)
def update_user_policy(
    policy_id: Annotated[UUID, Path(description="The policy ID.")],
    permissions_in: schemas.UserPolicyUpdate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Update a user policy with an ID"""

    UserContext.set(current_user.id)

    # Get a policy or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=policy_id)

    user_policy = crud.user_policy.update(
        db_session,
        user_policy_id=policy_id,
        obj_in=schemas.UserPolicyUpdate(permissions=permissions_in.permissions),
    )

    return user_policy


@router.delete(
    "/policies/{policy_id}",
    summary="Remove User Policy",
    response_description="Policy removed",
    response_model=schemas.Msg,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.remove())],
)
def remove_user_policy(
    policy_id: Annotated[UUID, Path(description="The policy ID.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Remove a user policy by providing an ID"""

    # Get a policy or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=policy_id)

    crud.user_policy.hard_remove(db_session, obj_id=policy_id)

    return {"msg": "User policy deleted successfully."}
