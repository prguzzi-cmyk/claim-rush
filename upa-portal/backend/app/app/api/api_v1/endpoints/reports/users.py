#!/usr/bin/env python

"""Routes for the User reports."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.rbac import Modules, Roles
from app.core.read_params_attrs import Ordering, UserSearch, UserSort
from app.models import Role, User, UserMeta
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.USER.value)
read_params = CommonReadParams(UserSearch, UserSort)
stmt_gen = SqlStmtGenerator(User)


@router.get(
    "/advanced-search",
    summary="Advanced Search",
    response_description="A list of users",
    response_model=CustomPage[schemas.User],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def advanced_search(
    *,
    first_name: Annotated[
        str, Query(description="Specify the user first name.")
    ] = None,
    last_name: Annotated[str, Query(description="Specify the user last name.")] = None,
    email: Annotated[str, Query(description="Specify the user email address.")] = None,
    address: Annotated[
        str, Query(description="Specify the user postal address.")
    ] = None,
    city: Annotated[str, Query(description="Specify the user city name.")] = None,
    state: Annotated[str, Query(description="Specify the user state name.")] = None,
    zip_code: Annotated[str, Query(description="Specify the user zip code.")] = None,
    phone_number: Annotated[
        str, Query(description="Specify the user phone number.")
    ] = None,
    role_id: Annotated[
        UUID, Query(description="Specify the role ID the user belongs to.")
    ] = None,
    role_display_name: Annotated[
        Roles, Query(description="Specify the role display name the user belongs to.")
    ] = None,
    is_active: Annotated[bool, Query(description="Specify the user status.")] = None,
    sort_by: read_params.sort_by() = UserSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve users by combining different filters."""

    # Apply filters
    filters_stmt = []

    if first_name is not None:
        filters_stmt.append(User.first_name.ilike(f"%{first_name}%"))

    if last_name is not None:
        filters_stmt.append(User.last_name.ilike(f"%{last_name}%"))

    if email is not None:
        filters_stmt.append(User.email.ilike(f"%{email}%"))

    if address is not None:
        filters_stmt.append(UserMeta.address.ilike(f"%{address}%"))

    if city is not None:
        filters_stmt.append(UserMeta.city.ilike(f"%{city}%"))

    if state is not None:
        filters_stmt.append(UserMeta.state.ilike(f"%{state}%"))

    if zip_code is not None:
        filters_stmt.append(UserMeta.zip_code.ilike(f"%{zip_code}%"))

    if phone_number is not None:
        filters_stmt.append(UserMeta.phone_number.ilike(f"%{phone_number}%"))

    if role_display_name is not None:
        filters_stmt.append(Role.display_name == f"{role_display_name.value}")

    if role_id is not None:
        filters_stmt.append(User.role_id == role_id)

    if is_active is not None:
        filters_stmt.append(User.is_active == is_active)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    users_list = crud.user.get_multi(
        db_session,
        join_target={User.user_meta, User.role},
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return users_list
