#!/usr/bin/env python

"""Routes for the Roles module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_db_session, must_be_superuser
from app.core.rbac import Modules
from app.utils.common import slugify

router = APIRouter()

permissions = Permissions(Modules.ROLE.value)


@router.get(
    "",
    summary="Read Roles",
    response_description="A list of roles",
    response_model=list[schemas.Role],
    dependencies=[Depends(must_be_superuser()), Depends(permissions.read())],
)
def read_roles(
    *,
    skip: Annotated[int, Query(description="Number of records to skip")] = 0,
    limit: Annotated[int, Query(description="Number of records to fetch")] = 100,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all roles"""
    roles = crud.role.get_multi(db_session, skip=skip, limit=limit)

    return roles


@router.get(
    "/{role_id}",
    summary="Read Role By Id",
    response_description="Role data",
    response_model=schemas.Role,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.read())],
)
def read_role_by_id(
    role_id: Annotated[UUID, Path(description="The role id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a role by an id"""
    role = crud.role.get(db_session, obj_id=role_id)

    # If there is no role
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    return role


@router.post(
    "",
    summary="Create Role",
    response_description="Role created",
    response_model=schemas.Role,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    role_in: schemas.RoleCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Create a new role"""
    if role_in.name:
        role = crud.role.get_by_name(db_session, name=role_in.name)
    else:
        role = crud.role.get_by_name(db_session, name=slugify(role_in.display_name))
    if role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The role with the name already exists in the system",
        )

    role = crud.role.create(db_session, obj_in=role_in)

    return role


@router.put(
    "/{role_id}",
    summary="Update Role",
    response_description="Updated role data",
    response_model=schemas.Role,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.update())],
)
def update_role(
    role_id: Annotated[UUID, Path(description="The role id")],
    role_in: schemas.RoleUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Update a role via an ID"""
    role = crud.role.get(db_session, obj_id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The role with name does not exist in the system",
        )

    role = crud.role.update(db_session, db_obj=role, obj_in=role_in)

    return role


@router.delete(
    "/{role_id}",
    summary="Remove Role",
    response_description="Role removed",
    response_model=schemas.Role,
    dependencies=[Depends(must_be_superuser()), Depends(permissions.remove())],
)
def remove_role(
    role_id: Annotated[UUID, Path(description="The role id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a role by providing an ID"""
    role = crud.role.get(db_session, obj_id=role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The role with this name does not exist in the system",
        )

    role = crud.role.remove(db_session, obj_id=role_id)

    return role
