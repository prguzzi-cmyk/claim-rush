#!/usr/bin/env python

"""API endpoints for Rotation Config management."""

from typing import Annotated, Any, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.models.rotation_config import RotationConfig

router = APIRouter()
permissions = Permissions(Modules.ROTATION_CONFIG.value)


@router.get(
    "",
    summary="List Rotation Configs",
    response_description="All rotation configs",
    response_model=list[schemas.RotationConfigSchema],
    dependencies=[Depends(permissions.read())],
)
def list_rotation_configs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all rotation configs (global default + territory overrides)."""
    return crud.rotation_config.get_multi(db_session, paginated=False)


@router.post(
    "",
    summary="Create or Get Rotation Config",
    response_description="Rotation config for the territory",
    response_model=schemas.RotationConfigSchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_rotation_config(
    config_in: schemas.RotationConfigCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a rotation config for a territory (or return existing)."""
    return crud.rotation_config.get_or_create_for_territory(
        db_session, territory_id=config_in.territory_id
    )


@router.patch(
    "/{config_id}",
    summary="Update Rotation Config",
    response_description="Updated rotation config",
    response_model=schemas.RotationConfigSchema,
    dependencies=[Depends(permissions.update())],
)
def update_rotation_config(
    config_id: UUID,
    config_in: schemas.RotationConfigUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update timeout, max attempts, or auto-reassign settings."""
    config = crud.rotation_config.get(db_session, obj_id=config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation config not found.",
        )
    return crud.rotation_config.update(db_session, db_obj=config, obj_in=config_in)
