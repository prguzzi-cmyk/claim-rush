#!/usr/bin/env python

"""Routes for the Roles module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status

from app import schemas
from app.api.deps import (
    Permissions,
    at_least_admin_user,
    get_current_user,
    must_be_superuser,
)
from app.api.deps.app import get_service_locator
from app.core.rbac import Modules
from app.core.response_manager import ResponseManager
from app.db.enums import RoleSearchField, RoleSortField
from app.models import User
from app.schemas import AppendPermissions, DetachPermissions
from app.service_locator import AppServiceLocator
from app.utils.contexts import UserContext

from app.utils.pagination import CustomPage
from app.utils.query_params import QueryParams

router = APIRouter()

response_manager = ResponseManager()
permissions = Permissions(Modules.ROLE.value)


@router.get(
    "",
    summary="Read Roles",
    response_description="A list of roles",
    response_model=CustomPage[schemas.Role],
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_roles(
    search_field: Annotated[
        RoleSearchField, Depends(QueryParams.search_field(RoleSearchField))
    ],
    search_value: Annotated[str | None, Depends(QueryParams.search_value())],
    sort_by: Annotated[dict, Depends(QueryParams.sort_by(RoleSortField))],
    only_removed: Annotated[bool, Depends(QueryParams.only_removed())],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> Any:
    """Retrieves all role entities from the database."""

    role_service = service_locator.get_role_service()

    if search_field:
        filters = {search_field.value: search_value}
    else:
        filters = None

    return role_service.get_all_roles(
        filters=filters,
        sort_by=sort_by,
        only_removed=only_removed,
    )


@router.get(
    "/{role_id}",
    summary="Read Role By Id",
    response_description="Role data",
    response_model=schemas.Role,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_role_by_id(
    role_id: Annotated[UUID, Path(description="The role id")],
    even_removed: Annotated[bool, Depends(QueryParams.even_removed())],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> Any:
    """Retrieves a role entity from the database by its unique ID."""

    role_service = service_locator.get_role_service()

    return role_service.get_role_by_id(role_id=role_id, even_removed=even_removed)


@router.get(
    "/{role_id}/permissions",
    summary="Read Role Permissions",
    response_description="Role Permissions data",
    response_model=CustomPage[schemas.PermissionMinimal],
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def read_role_permissions(
    role_id: Annotated[UUID, Path(description="The role ID.")],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> Any:
    """Retrieves a list of permissions associated with a given role."""

    role_service = service_locator.get_role_service()

    return role_service.get_permissions_for_role_paginated(role_id=role_id)


@router.post(
    "",
    summary="Create Role",
    response_description="Role created",
    response_model=schemas.Role,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_409_CONFLICT,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(must_be_superuser()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    role_in: schemas.RoleCreate,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Creates a new role entity in the database."""

    UserContext.set(current_user.id)

    role_service = service_locator.get_role_service()

    return role_service.create_role(role_in)


@router.post(
    "/{role_id}/append-permissions",
    summary="Append Permissions",
    response_description="Permissions appended",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[
        Depends(must_be_superuser()),
        Depends(permissions.assign_permission()),
    ],
)
def append_permissions(
    role_id: Annotated[UUID, Path(description="The role id.")],
    data_in: AppendPermissions,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> None:
    """Append permissions to a role."""

    role_service = service_locator.get_role_service()

    role_service.append_permissions(role_id, data_in)


@router.post(
    "/{role_id}/detach-permissions",
    summary="Detach Permissions",
    response_description="Permissions detached",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[
        Depends(must_be_superuser()),
        Depends(permissions.assign_permission()),
    ],
)
def detach_permissions(
    role_id: Annotated[UUID, Path(description="The role id.")],
    data_in: DetachPermissions,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> None:
    """Detach permissions from a role."""

    role_service = service_locator.get_role_service()

    role_service.detach_permissions(role_id, data_in)


@router.put(
    "/{role_id}",
    summary="Update Role",
    response_description="Updated role data",
    response_model=schemas.Role,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(must_be_superuser()), Depends(permissions.update())],
)
def update_role(
    role_id: Annotated[UUID, Path(description="The role id")],
    role_in: schemas.RoleUpdate,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Updates an existing role entity in the database."""

    UserContext.set(current_user.id)

    role_service = service_locator.get_role_service()

    return role_service.update_role(role_id=role_id, role_schema=role_in)


@router.patch(
    "/{role_id}/restore",
    summary="Restore Role",
    response_description="Role restored",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_role(
    role_id: Annotated[UUID, Path(description="The role id")],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> None:
    """Restore a Role via an ID"""

    role_service = service_locator.get_role_service()

    role_service.restore_role(role_id=role_id)


@router.delete(
    "/{role_id}",
    summary="Soft Remove Role",
    response_description="Role removed",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=response_manager.get_role_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(must_be_superuser()), Depends(permissions.remove())],
)
def soft_remove_role(
    role_id: Annotated[UUID, Path(description="The role id")],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
) -> None:
    """Softly removes a role entity by marking it as removed in the database."""

    role_service = service_locator.get_role_service()

    role_service.soft_remove_role(role_id=role_id)
