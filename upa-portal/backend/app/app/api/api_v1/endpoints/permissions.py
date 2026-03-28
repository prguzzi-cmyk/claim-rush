#!/usr/bin/env python

"""Routes for the Permissions module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import (
    Permissions,
    get_current_user,
    get_db_session,
    must_be_superuser,
)
from app.core.rbac import Modules
from app.models import User
from app.utils.common import generate_permission
from app.utils.contexts import UserContext
from app.utils.pagination import CustomPage

router = APIRouter()

permissions = Permissions(Modules.PERMISSION.value)


@router.get(
    "",
    summary="Read Permissions",
    response_description="A list of permissions",
    response_model=CustomPage[schemas.Permission],
    dependencies=[Depends(must_be_superuser()), Depends(permissions.read())],
)
def read_permissions(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all permissions"""
    permissions_list = crud.permission.get_multi(db_session)

    return permissions_list


@router.get(
    "/{permission_id}",
    summary="Read Permission By Id",
    response_description="Permission data",
    response_model=schemas.Permission,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.read())],
)
def read_permission_by_id(
    permission_id: Annotated[UUID, Path(description="The permission id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a permission by an id"""
    permission = crud.permission.get(db_session, obj_id=permission_id)

    # If there is no permission
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found"
        )

    return permission


@router.post(
    "",
    summary="Create Permission",
    response_description="Permission created",
    response_model=schemas.Permission,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_permission(
    permission_in: schemas.PermissionCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new permission"""

    UserContext.set(current_user.id)

    permission_name = generate_permission(
        module=permission_in.module, operation=permission_in.operation
    )
    permission = crud.permission.get_by_name(db_session, name=permission_name)
    if permission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The permission with the name already exists in the system",
        )

    permission = crud.permission.create(db_session, obj_in=permission_in)

    return permission


@router.put(
    "/{permission_id}",
    summary="Update Permission",
    response_description="Updated permission data",
    response_model=schemas.Permission,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.update())],
)
def update_permission(
    permission_id: Annotated[UUID, Path(description="The permission id")],
    permission_in: schemas.PermissionUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a permission via an ID"""

    UserContext.set(current_user.id)

    permission = crud.permission.get(db_session, obj_id=permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The permission with name does not exist in the system",
        )

    permission = crud.permission.update(
        db_session, db_obj=permission, obj_in=permission_in
    )

    return permission


@router.delete(
    "/{permission_id}",
    summary="Remove Permission",
    response_description="Permission removed",
    response_model=schemas.Permission,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.remove())],
)
def remove_permission(
    permission_id: Annotated[UUID, Path(description="The permission id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a permission by providing an ID"""
    permission = crud.permission.get(db_session, obj_id=permission_id)
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The permission with this name does not exist in the system",
        )

    permission = crud.permission.remove(db_session, obj_id=permission_id)

    return permission
