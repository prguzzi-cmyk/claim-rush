#!/usr/bin/env python

"""Routes for the Crime Data Source Configs module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.crime_data_source_config import (
    CrimeDataSourceConfig,
    CrimeSourceStatusOut,
)
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage

router = APIRouter()

permissions = Permissions(Modules.CRIME_DATA_SOURCE_CONFIG.value)
crud_util = CrudUtil(crud.crime_data_source_config)


@router.get(
    "",
    summary="List Crime Data Source Configs",
    response_description="Paginated list of crime data source configurations",
    response_model=CustomPage[CrimeDataSourceConfig],
    dependencies=[Depends(permissions.read())],
)
def read_crime_data_source_configs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all crime data source configurations."""
    return crud.crime_data_source_config.get_multi(db_session)


@router.get(
    "/{config_id}",
    summary="Get Crime Data Source Config",
    response_description="Crime data source config detail",
    response_model=CrimeDataSourceConfig,
    dependencies=[Depends(permissions.read())],
)
def read_crime_data_source_config(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single crime data source config by UUID."""
    return crud_util.get_object_or_raise_exception(db_session, object_id=config_id)


@router.post(
    "",
    summary="Create Crime Data Source Config",
    response_description="Newly created crime data source config",
    response_model=CrimeDataSourceConfig,
    dependencies=[Depends(permissions.create())],
)
def create_crime_data_source_config(
    config_in: schemas.CrimeDataSourceConfigCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new crime data source configuration."""
    return crud.crime_data_source_config.create(db_session, obj_in=config_in)


@router.put(
    "/{config_id}",
    summary="Update Crime Data Source Config",
    response_description="Updated crime data source config",
    response_model=CrimeDataSourceConfig,
    dependencies=[Depends(permissions.update())],
)
def update_crime_data_source_config(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    config_in: schemas.CrimeDataSourceConfigUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a crime data source configuration."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)
    return crud.crime_data_source_config.update(db_session, db_obj=db_obj, obj_in=config_in)


@router.post(
    "/{config_id}/poll",
    summary="Manually Poll a Crime Data Source",
    response_description="Poll result message",
    dependencies=[Depends(permissions.update())],
)
def poll_crime_data_source(
    config_id: Annotated[UUID, Path(description="The config UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Manually trigger a poll for a specific crime data source config."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=config_id)

    from app.tasks.crime_ingestion import _fetch_for_config, _upsert_incidents

    try:
        incidents = _fetch_for_config(db_obj)
        count = _upsert_incidents(db_session, db_obj, incidents)

        crud.crime_data_source_config.update_poll_status(
            db_session,
            config_id=db_obj.id,
            status="connected",
            record_count=count,
        )

        return {"msg": f"Poll complete. {count} crime incidents processed."}
    except Exception as exc:
        crud.crime_data_source_config.update_poll_status(
            db_session,
            config_id=db_obj.id,
            status="error",
            record_count=0,
        )
        return {"msg": f"Poll failed: {exc}"}
