#!/usr/bin/env python

"""Routes for the Fire Data Source Configs module"""

import json
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

permissions = Permissions(Modules.FIRE_DATA_SOURCE_CONFIG.value)
crud_util = CrudUtil(crud.fire_data_source_config)


@router.get(
    "",
    summary="List Fire Data Source Configs",
    response_description="Paginated list of fire data source configurations",
    response_model=CustomPage[schemas.FireDataSourceConfig],
    dependencies=[Depends(permissions.read())],
)
def read_fire_data_source_configs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all fire data source configurations."""
    return crud.fire_data_source_config.get_multi(db_session)


@router.get(
    "/{config_id}",
    summary="Get Fire Data Source Config",
    response_description="Fire data source config detail",
    response_model=schemas.FireDataSourceConfig,
    dependencies=[Depends(permissions.read())],
)
def read_fire_data_source_config(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single fire data source config by UUID."""
    return crud_util.get_object_or_raise_exception(db_session, object_id=config_id)


@router.post(
    "",
    summary="Create Fire Data Source Config",
    response_description="Newly created fire data source config",
    response_model=schemas.FireDataSourceConfig,
    dependencies=[Depends(permissions.create())],
)
def create_fire_data_source_config(
    config_in: schemas.FireDataSourceConfigCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new fire data source configuration."""
    return crud.fire_data_source_config.create(db_session, obj_in=config_in)


@router.put(
    "/{config_id}",
    summary="Update Fire Data Source Config",
    response_description="Updated fire data source config",
    response_model=schemas.FireDataSourceConfig,
    dependencies=[Depends(permissions.update())],
)
def update_fire_data_source_config(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    config_in: schemas.FireDataSourceConfigUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a fire data source configuration."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)
    return crud.fire_data_source_config.update(db_session, db_obj=db_obj, obj_in=config_in)


@router.delete(
    "/{config_id}",
    summary="Delete Fire Data Source Config",
    response_description="Deletion result",
    dependencies=[Depends(permissions.remove())],
)
def delete_fire_data_source_config(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Delete a fire data source configuration."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)
    crud.fire_data_source_config.hard_remove(db_session, obj_id=db_obj.id)
    return {"msg": "Data source config deleted."}


@router.post(
    "/{config_id}/poll",
    summary="Manually Poll a Data Source",
    response_description="Poll result message",
    dependencies=[Depends(permissions.update())],
)
def poll_fire_data_source(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually trigger a poll for a specific data source config."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)

    extra = {}
    if db_obj.extra_config:
        try:
            extra = json.loads(db_obj.extra_config)
        except (json.JSONDecodeError, TypeError):
            pass

    count = 0

    if db_obj.source_type == "socrata":
        from app.utils.socrata import fetch_socrata_incidents

        incidents = fetch_socrata_incidents(
            endpoint_url=db_obj.endpoint_url,
            dataset_id=db_obj.dataset_id or "",
            since_datetime=db_obj.last_polled_at,
            extra_config=db_obj.extra_config,
        )
        count = crud.fire_incident.upsert_from_external(
            db_session, incidents_list=incidents, data_source="socrata"
        )

    elif db_obj.source_type == "nifc":
        from app.utils.nifc import fetch_nifc_incidents

        incidents = fetch_nifc_incidents(endpoint_url=db_obj.endpoint_url)
        count = crud.fire_incident.upsert_from_external(
            db_session, incidents_list=incidents, data_source="nifc"
        )

    elif db_obj.source_type == "firms":
        from app.utils.firms import fetch_firms_hotspots
        from app.core.config import settings

        api_key = db_obj.api_key or settings.FIRMS_API_KEY
        if not api_key:
            return {"msg": "FIRMS API key not configured."}

        incidents = fetch_firms_hotspots(
            api_key=api_key,
            area=extra.get("area", "-125,24,-66,50"),
            days=extra.get("days", 1),
            source=extra.get("source", "VIIRS_SNPP_NRT"),
        )
        count = crud.fire_incident.upsert_from_external(
            db_session, incidents_list=incidents, data_source="firms"
        )

    crud.fire_data_source_config.update_last_polled(
        db_session, config_id=db_obj.id
    )

    return {"msg": f"Poll complete. {count} incidents processed."}
