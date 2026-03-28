#!/usr/bin/env python

"""Routes for the Partnership module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import Ordering, PartnershipSearch, PartnershipSort
from app.models import Partnership, User
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.PARTNERSHIP.value)
crud_util = CrudUtil(crud.partnership)
read_params = CommonReadParams(PartnershipSearch, PartnershipSort)
stmt_gen = SqlStmtGenerator(Partnership)


@router.get(
    "",
    summary="Read Partnerships",
    response_description="A list of Partnerships",
    response_model=CustomPage[schemas.Partnership],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_partnerships(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = PartnershipSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of Partnerships."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    partnerships = crud.partnership.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return partnerships


@router.get(
    "/{partnership_id}",
    summary="Read Partnership By Id",
    response_description="Partnership data",
    response_model=schemas.Partnership,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_partnership_by_id(
    partnership_id: Annotated[UUID, Path(description="The Partnership ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a Partnership by an ID."""

    # Get a Partnership or raise an exception
    partnership = crud_util.get_object_or_raise_exception(
        db_session, object_id=partnership_id
    )

    return partnership


@router.post(
    "",
    summary="Create Partnership",
    response_description="Partnership created",
    response_model=schemas.Partnership,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_partnership(
    partnership_in: schemas.PartnershipCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new Partnership"""

    UserContext.set(current_user.id)

    partnership = crud.partnership.create(db_session, obj_in=partnership_in)

    return partnership


@router.put(
    "/{partnership_id}",
    summary="Update Partnership",
    response_description="Updated Partnership data",
    response_model=schemas.Partnership,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_partnership(
    partnership_id: Annotated[UUID, Path(description="The Partnership ID.")],
    partnership_in: schemas.PartnershipUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a Partnership via an ID."""

    UserContext.set(current_user.id)

    # Get a Partnership or raise an exception
    partnership = crud_util.get_object_or_raise_exception(
        db_session, object_id=partnership_id
    )

    partnership = crud.partnership.update(
        db_session, db_obj=partnership, obj_in=partnership_in
    )

    return partnership


@router.patch(
    "/{partnership_id}/restore",
    summary="Restore Partnership",
    response_description="Restored Partnership data",
    response_model=schemas.Partnership,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_partnership(
    partnership_id: Annotated[UUID, Path(description="The Partnership ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Restore a Partnership via an ID."""

    UserContext.set(current_user.id)

    # Get a Partnership or raise an exception
    partnership = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=partnership_id
    )

    partnership = crud.partnership.restore(db_session, db_obj=partnership)

    return partnership


@router.delete(
    "/{partnership_id}",
    summary="Remove Partnership",
    response_description="Partnership removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_partnership(
    partnership_id: Annotated[UUID, Path(description="The Partnership ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a Partnership by providing an ID."""

    # Get a Partnership or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=partnership_id)

    crud.partnership.remove(db_session, obj_id=partnership_id)

    return {"msg": "Partnership removed successfully."}
