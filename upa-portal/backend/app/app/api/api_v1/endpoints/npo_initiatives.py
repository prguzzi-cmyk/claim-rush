#!/usr/bin/env python

"""Routes for the NPO Initiative module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import NPOInitiativeSearch, NPOInitiativeSort, Ordering
from app.models import NpoInitiative, User
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.NPO_INITIATIVE.value)
crud_util = CrudUtil(crud.npo_initiative)
read_params = CommonReadParams(NPOInitiativeSearch, NPOInitiativeSort)
stmt_gen = SqlStmtGenerator(NpoInitiative)


@router.get(
    "",
    summary="Read NPO Initiatives",
    response_description="A list of NPO Initiatives",
    response_model=CustomPage[schemas.NPOInitiative],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_npo_initiatives(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = NPOInitiativeSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of NPO Initiatives."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    npo_initiatives = crud.npo_initiative.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return npo_initiatives


@router.get(
    "/{npo_initiative_id}",
    summary="Read NPO Initiative By Id",
    response_description="NPO Initiative data",
    response_model=schemas.NPOInitiative,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_npo_initiative_by_id(
    npo_initiative_id: Annotated[UUID, Path(description="The NPO Initiative ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a NPO Initiative by an id."""

    # Get a NPO Initiative or raise an exception
    npo_initiative = crud_util.get_object_or_raise_exception(
        db_session, object_id=npo_initiative_id
    )

    return npo_initiative


@router.post(
    "",
    summary="Create NPO Initiative",
    response_description="NPO Initiative created",
    response_model=schemas.NPOInitiative,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_npo_initiative(
    npo_initiative_in: schemas.NPOInitiativeCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new NPO Initiative"""

    UserContext.set(current_user.id)

    npo_initiative = crud.npo_initiative.create(db_session, obj_in=npo_initiative_in)

    return npo_initiative


@router.put(
    "/{npo_initiative_id}",
    summary="Update NPO Initiative",
    response_description="Updated NPO Initiative data",
    response_model=schemas.NPOInitiative,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_npo_initiative(
    npo_initiative_id: Annotated[UUID, Path(description="The NPO Initiative ID.")],
    npo_initiative_in: schemas.NPOInitiativeUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a NPO Initiative via an ID."""

    UserContext.set(current_user.id)

    # Get a NPO Initiative or raise an exception
    npo_initiative = crud_util.get_object_or_raise_exception(
        db_session, object_id=npo_initiative_id
    )

    npo_initiative = crud.npo_initiative.update(
        db_session, db_obj=npo_initiative, obj_in=npo_initiative_in
    )

    return npo_initiative


@router.patch(
    "/{npo_initiative_id}/restore",
    summary="Restore NPO Initiative",
    response_description="Restored NPO Initiative data",
    response_model=schemas.NPOInitiative,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_npo_initiative(
    npo_initiative_id: Annotated[UUID, Path(description="The NPO Initiative ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Restore a NPO Initiative via an ID."""

    UserContext.set(current_user.id)

    # Get a NPO Initiative or raise an exception
    npo_initiative = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=npo_initiative_id
    )

    npo_initiative = crud.npo_initiative.restore(db_session, db_obj=npo_initiative)

    return npo_initiative


@router.delete(
    "/{npo_initiative_id}",
    summary="Remove NPO Initiative",
    response_description="NPO Initiative removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_npo_initiative(
    npo_initiative_id: Annotated[UUID, Path(description="The NPO Initiative ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a NPO Initiative by providing an ID."""

    # Get a NPO Initiative or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=npo_initiative_id)

    crud.npo_initiative.remove(db_session, obj_id=npo_initiative_id)

    return {"msg": "NPO Initiative removed successfully."}
