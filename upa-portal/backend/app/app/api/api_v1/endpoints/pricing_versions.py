#!/usr/bin/env python

"""Routes for the Pricing Versions module"""

import csv
import io
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi_pagination import Page
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.pricing_item import PricingItemCreate
from app.utils.exceptions import exc_bad_request, exc_not_found

router = APIRouter()

permissions = Permissions(Modules.ESTIMATE_PROJECT.value)


@router.post(
    "",
    summary="Create Pricing Version",
    response_description="Newly created pricing version",
    response_model=schemas.PricingVersion,
    dependencies=[Depends(permissions.create())],
)
def create_pricing_version(
    obj_in: schemas.PricingVersionCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new pricing version (draft status by default)."""
    version = crud.pricing_version.create(db_session, obj_in=obj_in)
    return version


@router.get(
    "",
    summary="List Pricing Versions",
    response_description="Paginated list of pricing versions",
    response_model=Page[schemas.PricingVersion],
    dependencies=[Depends(permissions.read())],
)
def list_pricing_versions(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    status: Annotated[str | None, Query(description="Filter by status")] = None,
    source: Annotated[str | None, Query(description="Filter by source")] = None,
    region: Annotated[str | None, Query(description="Filter by region")] = None,
) -> Any:
    """List all pricing versions with optional filtering."""
    filters = []
    if status:
        filters.append(models.PricingVersion.status == status)
    if source:
        filters.append(models.PricingVersion.source == source)
    if region:
        filters.append(models.PricingVersion.region == region)

    return crud.pricing_version.get_multi(
        db_session,
        filters=filters if filters else None,
        order_by=[models.PricingVersion.created_at.desc()],
    )


@router.get(
    "/{version_id}",
    summary="Get Pricing Version",
    response_description="Pricing version detail",
    response_model=schemas.PricingVersion,
    dependencies=[Depends(permissions.read())],
)
def get_pricing_version(
    version_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get a pricing version by ID."""
    version = crud.pricing_version.get(db_session, obj_id=version_id)
    if not version:
        exc_not_found("Pricing version not found.")
    return version


@router.patch(
    "/{version_id}",
    summary="Update Pricing Version",
    response_description="Updated pricing version",
    response_model=schemas.PricingVersion,
    dependencies=[Depends(permissions.update())],
)
def update_pricing_version(
    version_id: UUID,
    obj_in: schemas.PricingVersionUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a pricing version's status or notes."""
    version = crud.pricing_version.get(db_session, obj_id=version_id)
    if not version:
        exc_not_found("Pricing version not found.")
    return crud.pricing_version.update(db_session, db_obj=version, obj_in=obj_in)


@router.post(
    "/{version_id}/activate",
    summary="Activate Pricing Version",
    response_description="Activated pricing version",
    response_model=schemas.PricingVersion,
    dependencies=[Depends(permissions.update())],
)
def activate_pricing_version(
    version_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Activate a pricing version, archiving any previous active version for the same source+region."""
    version = crud.pricing_version.activate(db_session, version_id=version_id)
    if not version:
        exc_not_found("Pricing version not found.")
    return version


@router.post(
    "/{version_id}/import",
    summary="Import Pricing Items",
    response_description="Import result summary",
    dependencies=[Depends(permissions.create())],
)
async def import_pricing_items(
    version_id: UUID,
    file: UploadFile = File(...),
    db_session: Session = Depends(get_db_session),
    current_user: models.User = Depends(get_current_active_user),
) -> Any:
    """Bulk import pricing items from a CSV file into a version."""
    version = crud.pricing_version.get(db_session, obj_id=version_id)
    if not version:
        exc_not_found("Pricing version not found.")

    if version.status == "archived":
        exc_bad_request("Cannot import items into an archived version.")

    # Read and parse CSV
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    items = []
    errors = []
    row_count = 0
    for row_num, row in enumerate(reader, start=2):
        row_count += 1
        code = row.get("code", "").strip()
        if not code:
            errors.append(f"Row {row_num}: missing code")
            continue

        try:
            items.append(
                PricingItemCreate(
                    code=code,
                    category=row.get("category", "").strip() or None,
                    description=row.get("description", "").strip() or None,
                    unit=row.get("unit", "").strip() or None,
                    base_cost=float(row["base_cost"]) if row.get("base_cost") else None,
                    labor_cost=float(row["labor_cost"]) if row.get("labor_cost") else None,
                    material_cost=float(row["material_cost"]) if row.get("material_cost") else None,
                    version_id=version_id,
                )
            )
        except (ValueError, KeyError) as e:
            errors.append(f"Row {row_num}: {str(e)}")

    imported_count = 0
    if items:
        imported_count = crud.pricing_version.bulk_import_items(
            db_session, version_id=version_id, items=items
        )

    return {
        "imported": imported_count,
        "errors": errors,
        "total_rows": row_count,
    }


@router.get(
    "/{version_id}/items",
    summary="List Version Items",
    response_description="Paginated list of pricing items in a version",
    response_model=Page[schemas.PricingItem],
    dependencies=[Depends(permissions.read())],
)
def list_version_items(
    version_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """List pricing items within a specific version."""
    version = crud.pricing_version.get(db_session, obj_id=version_id)
    if not version:
        exc_not_found("Pricing version not found.")

    return crud.pricing_item.get_multi(
        db_session,
        filters=[models.PricingItem.version_id == version_id],
    )
