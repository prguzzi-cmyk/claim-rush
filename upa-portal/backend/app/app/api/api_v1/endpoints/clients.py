#!/usr/bin/env python

"""Routes for the Clients module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.rbac import Modules
from app.core.read_params_attrs import ClientSearch, ClientSort, Ordering
from app.models import Client
from app.utils.client import (
    validate_client_ownership,
    validate_client_ownership_or_collaboration,
)
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClientSqlStmtGenerator
from app.utils.territory_filter import get_client_territory_filters

router = APIRouter()

permissions = Permissions(Modules.CLIENT.value)
crud_util = CrudUtil(crud.client)
crud_util_user = CrudUtil(crud.user)
read_params = CommonReadParams(ClientSearch, ClientSort)
stmt_gen = ClientSqlStmtGenerator(Client)


@router.get(
    "",
    summary="Read Clients",
    response_description="A list of clients",
    response_model=CustomPage[schemas.Client],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_clients(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = ClientSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all clients."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    # Apply territory-based access filters
    territory_filters = get_client_territory_filters(db_session, current_user)
    if territory_filters:
        if filters_stmt is None:
            filters_stmt = territory_filters
        else:
            filters_stmt.extend(territory_filters)

    if crud.user.has_admin_privileges(current_user):
        clients_list = crud.client.get_multi(
            db_session,
            join_target=stmt_gen.join_stmt(),
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        clients_list = crud.client.get_belonged(
            db_session,
            current_user=current_user,
            join_target=stmt_gen.join_stmt(),
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )

    return clients_list


@router.get(
    "/{client_id}",
    summary="Read Client By Id",
    response_description="Client data",
    response_model=schemas.Client,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_by_id(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a client by an id."""

    # Get a client or raise an exception
    client = crud_util.get_object_or_raise_exception(db_session, object_id=client_id)

    # Validate client ownership
    validate_client_ownership_or_collaboration(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
        db_session=db_session,
    )

    return client


@router.get(
    "/{client_id}/leads",
    summary="Read Client Leads",
    response_description="Leads data",
    response_model=CustomPage[schemas.Lead],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_leads(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of client leads."""

    # Get a client or raise an exception
    client: Client = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    return crud.client.get_leads(db_session, obj_id=client_id)


@router.get(
    "/{client_id}/claims",
    summary="Read Client Claims",
    response_description="Claims data",
    response_model=CustomPage[schemas.Claim],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_claims(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of client claims."""

    # Get a client or raise an exception
    client: Client = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership_or_collaboration(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
        db_session=db_session,
    )

    return crud.client.get_claims(db_session, obj_id=client_id)


@router.post(
    "",
    summary="Create Client",
    response_description="Client created",
    response_model=schemas.Client,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_client(
    client_in: schemas.ClientCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new client."""

    UserContext.set(current_user.id)

    # Get a user or raise an exception
    crud_util_user.get_object_or_raise_exception(
        db_session,
        object_id=client_in.belongs_to,
        err_msg="Provided user id for the `belongs_to` field not found.",
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client_in,
        exception_msg="You are not allowed to assign this client to someone else.",
    )

    client = crud.client.create(db_session, obj_in=client_in)

    return client


@router.put(
    "/{client_id}",
    summary="Update Client",
    response_description="Updated client data",
    response_model=schemas.Client,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_client(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    client_in: schemas.ClientUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a client via an ID."""

    UserContext.set(current_user.id)

    # Get a client or raise an exception
    client = crud_util.get_object_or_raise_exception(db_session, object_id=client_id)

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="You are not allowed to update records of this client.",
    )

    # Get a user or raise an exception
    if client_in.belongs_to:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=client_in.belongs_to,
            err_msg="Provided user id for the `belongs_to` field not found.",
        )

    client = crud.client.update(db_session, db_obj=client, obj_in=client_in)

    return client


@router.delete(
    "/{client_id}",
    summary="Remove Client",
    response_description="Client removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_client(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a client by providing an ID"""

    # Get a client or raise an exception
    client = crud_util.get_object_or_raise_exception(db_session, object_id=client_id)

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    crud.client.remove(db_session, obj_id=client_id)

    return {"msg": "Client removed successfully."}
