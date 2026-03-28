#!/usr/bin/env python

"""Routes for the Pricing module"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.pricing_item import PricingItemCreate
from app.utils.pricing_api import search_pricing

router = APIRouter()

permissions = Permissions(Modules.ESTIMATE_PROJECT.value)


@router.get(
    "/search",
    summary="Search Pricing Items",
    response_description="List of matching pricing items",
    response_model=list[schemas.PricingItem],
    dependencies=[Depends(permissions.read())],
)
def search_pricing_items(
    q: Annotated[str, Query(min_length=1, description="Search query")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    region: Annotated[str, Query(description="Pricing region")] = "national",
) -> Any:
    """
    Search for pricing items. Checks local DB first, falls back to external API.
    Results from the external API are cached locally for future searches.
    Searches within the active pricing version for the specified region.
    """
    # Resolve active pricing version for the region
    active_version = crud.pricing_version.get_active(db_session, region=region)
    if not active_version and region != "national":
        active_version = crud.pricing_version.get_active(db_session, region="national")

    version_id = active_version.id if active_version else None

    # 1. Search local DB within the active version
    local_results = crud.pricing_item.search_by_query(
        db_session, query=q, version_id=version_id
    )
    if local_results:
        return local_results

    # 2. Fall back to external API
    api_results = search_pricing(q)
    if not api_results:
        return []

    # 3. Cache results locally via upsert (into the active version)
    cached = []
    for item_data in api_results:
        code = item_data.get("code")
        if not code:
            continue
        obj_in = PricingItemCreate(
            code=code,
            category=item_data.get("category"),
            description=item_data.get("description"),
            unit=item_data.get("unit"),
            base_cost=item_data.get("base_cost"),
            labor_cost=item_data.get("labor_cost"),
            material_cost=item_data.get("material_cost"),
            version_id=version_id,
        )
        cached_item = crud.pricing_item.upsert(db_session, obj_in=obj_in)
        cached.append(cached_item)

    return cached
