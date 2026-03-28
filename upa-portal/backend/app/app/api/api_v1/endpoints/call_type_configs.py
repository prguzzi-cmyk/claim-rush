#!/usr/bin/env python

"""Routes for the Call Type Config module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage

router = APIRouter()

permissions = Permissions(Modules.CALL_TYPE_CONFIG.value)
crud_util = CrudUtil(crud.call_type_config)


@router.get(
    "",
    summary="List Call Type Configs",
    response_description="All call type configurations",
    response_model=CustomPage[schemas.CallTypeConfig],
    dependencies=[Depends(permissions.read())],
)
def read_call_type_configs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all call type configurations (admin view)."""
    return crud.call_type_config.get_multi(
        db_session,
        order_by=[models.CallTypeConfig.sort_order],
    )


@router.get(
    "/enabled",
    summary="List Enabled Call Types",
    response_description="Enabled call type codes",
)
def read_enabled_call_types(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return only enabled call type codes (for any authenticated user)."""
    codes = crud.call_type_config.get_enabled_codes(db_session)
    return {"items": codes}


@router.put(
    "/{config_id}",
    summary="Update Call Type Config",
    response_description="Updated call type config",
    response_model=schemas.CallTypeConfig,
    dependencies=[Depends(permissions.update())],
)
def update_call_type_config(
    config_id: Annotated[UUID, Path(description="The call type config UUID.")],
    config_in: schemas.CallTypeConfigUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a call type config (toggle is_enabled, edit description, etc.)."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)
    return crud.call_type_config.update(db_session, db_obj=db_obj, obj_in=config_in)
