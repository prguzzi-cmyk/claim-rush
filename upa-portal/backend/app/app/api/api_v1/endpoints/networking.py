#!/usr/bin/env python

"""Routes for the Network module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import NetworkSearch, NetworkSort, Ordering
from app.models import Network, User
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.NETWORK.value)
crud_util = CrudUtil(crud.network)
read_params = CommonReadParams(NetworkSearch, NetworkSort)
stmt_gen = SqlStmtGenerator(Network)


@router.get(
    "",
    summary="Read Networks",
    response_description="A list of Networks",
    response_model=CustomPage[schemas.Network],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_networks(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = NetworkSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of Networks."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    networks = crud.network.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return networks


@router.get(
    "/{network_id}",
    summary="Read Network By Id",
    response_description="Network data",
    response_model=schemas.Network,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_network_by_id(
    network_id: Annotated[UUID, Path(description="The Network ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a Network by an ID."""

    # Get a Network or raise an exception
    network = crud_util.get_object_or_raise_exception(db_session, object_id=network_id)

    return network


@router.post(
    "",
    summary="Create Network",
    response_description="Network created",
    response_model=schemas.Network,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_network(
    network_in: schemas.NetworkCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new Network"""

    UserContext.set(current_user.id)

    network = crud.network.create(db_session, obj_in=network_in)

    return network


@router.put(
    "/{network_id}",
    summary="Update Network",
    response_description="Updated Network data",
    response_model=schemas.Network,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_network(
    network_id: Annotated[UUID, Path(description="The Network ID.")],
    network_in: schemas.NetworkUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a Network via an ID."""

    UserContext.set(current_user.id)

    # Get a Network or raise an exception
    network = crud_util.get_object_or_raise_exception(db_session, object_id=network_id)

    network = crud.network.update(db_session, db_obj=network, obj_in=network_in)

    return network


@router.patch(
    "/{network_id}/restore",
    summary="Restore Network",
    response_description="Restored Network data",
    response_model=schemas.Network,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_network(
    network_id: Annotated[UUID, Path(description="The Network ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Restore a Network via an ID."""

    UserContext.set(current_user.id)

    # Get a Network or raise an exception
    network = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=network_id
    )

    network = crud.network.restore(db_session, db_obj=network)

    return network


@router.delete(
    "/{network_id}",
    summary="Remove Network",
    response_description="Network removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_network(
    network_id: Annotated[UUID, Path(description="The Network ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a Network by providing an ID."""

    # Get a Network or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=network_id)

    crud.network.remove(db_session, obj_id=network_id)

    return {"msg": "Network removed successfully."}
