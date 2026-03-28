#!/usr/bin/env python

"""Routes for the Territory management module"""

from collections import defaultdict
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.exceptions import CrudUtil

router = APIRouter()

permissions = Permissions(Modules.TERRITORY.value)
crud_util = CrudUtil(crud.territory)


# ─── Territory CRUD ───

@router.get(
    "",
    summary="List Territories",
    response_description="List of all active territories",
    response_model=list[schemas.TerritorySchema],
    dependencies=[Depends(permissions.read())],
)
def read_territories(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    territory_type: Annotated[str | None, Query(description="Filter by type: state, county, zip, custom")] = None,
) -> Any:
    """Retrieve territories, optionally filtered by type."""
    if territory_type:
        return crud.territory.get_by_type(db_session, territory_type=territory_type)
    return crud.territory.get_active(db_session)


@router.post(
    "",
    summary="Create Territory",
    response_description="The newly created territory",
    response_model=schemas.TerritorySchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_territory(
    territory_in: schemas.TerritoryCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new territory definition."""
    valid_types = {"state", "county", "zip", "custom"}
    if territory_in.territory_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"territory_type must be one of: {', '.join(sorted(valid_types))}",
        )
    return crud.territory.create(db_session, obj_in=territory_in)


@router.get(
    "/with-assignments",
    summary="List Territories with Assignments",
    response_description="All territories with assigned user info",
    response_model=list[schemas.TerritoryWithAssignments],
    dependencies=[Depends(permissions.read())],
)
def read_territories_with_assignments(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all territories (active + inactive) with assigned users for map view."""
    territories = crud.territory.get_all_with_assignments(db_session)
    result = []
    for t in territories:
        # All UserTerritory entries are adjusters (CP stored on Territory directly)
        adjusters = [
            schemas.UserBrief(
                user_id=ut.user.id,
                first_name=ut.user.first_name or "",
                last_name=ut.user.last_name or "",
            )
            for ut in t.user_territories
            if ut.user is not None
        ]

        # CP from the direct relationship
        cp_brief = None
        if t.chapter_president is not None:
            cp_brief = schemas.UserBrief(
                user_id=t.chapter_president.id,
                first_name=t.chapter_president.first_name or "",
                last_name=t.chapter_president.last_name or "",
            )

        # Compute territory status — must match public_territories.py logic
        max_adj = t.max_adjusters or 3
        if not t.is_active:
            territory_status = "Locked"
        elif len(adjusters) >= max_adj:
            territory_status = "Full"
        elif t.chapter_president_id is not None:
            territory_status = "CP Assigned"
        else:
            territory_status = "Available"

        result.append(
            schemas.TerritoryWithAssignments(
                **{
                    c.key: getattr(t, c.key)
                    for c in t.__table__.columns
                },
                assigned_users=adjusters,  # backward compat
                chapter_president=cp_brief,
                adjusters=adjusters,
                adjuster_count=len(adjusters),
                territory_status=territory_status,
            )
        )
    return result


@router.get(
    "/grouped",
    summary="List Territories Grouped by State",
    response_model=list[schemas.TerritoryGroupedByState],
    dependencies=[Depends(permissions.read())],
)
def read_territories_grouped(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return active county territories grouped by state for lead distribution dropdown."""
    counties = crud.territory.get_by_type(db_session, territory_type="county")
    grouped: dict[str, list] = defaultdict(list)
    for t in counties:
        if t.is_active:
            grouped[t.state or "Unknown"].append(t)
    return [
        schemas.TerritoryGroupedByState(state=state, counties=items)
        for state, items in sorted(grouped.items())
    ]


@router.get(
    "/{territory_id}",
    summary="Get Territory",
    response_description="Territory detail",
    response_model=schemas.TerritorySchema,
    dependencies=[Depends(permissions.read())],
)
def read_territory(
    territory_id: Annotated[UUID, Path(description="The territory UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get a single territory by ID."""
    return crud_util.get_object_or_raise_exception(db_session, object_id=territory_id)


@router.put(
    "/{territory_id}",
    summary="Update Territory",
    response_description="The updated territory",
    response_model=schemas.TerritorySchema,
    dependencies=[Depends(permissions.update())],
)
def update_territory(
    territory_id: Annotated[UUID, Path(description="The territory UUID.")],
    territory_in: schemas.TerritoryUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a territory definition."""
    db_obj = crud_util.get_object_or_raise_exception(db_session, object_id=territory_id)
    return crud.territory.update(db_session, db_obj=db_obj, obj_in=territory_in)


# ─── User Territory Assignments ───

@router.get(
    "/users/{user_id}",
    summary="Get User Territories",
    response_description="Territories assigned to the user",
    response_model=schemas.UserTerritoryInfo,
    dependencies=[Depends(permissions.read())],
)
def read_user_territories(
    user_id: Annotated[UUID, Path(description="The user UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get all territory assignments for a user, plus their national_access flag."""
    user_obj = crud.user.get(db_session, obj_id=user_id)
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    territories = crud.territory.get_user_territories(db_session, user_id=user_id)
    return schemas.UserTerritoryInfo(
        national_access=getattr(user_obj, "national_access", False),
        territories=territories,
    )


@router.post(
    "/users/{user_id}/assign",
    summary="Assign Territories to User",
    response_description="Confirmation message",
    dependencies=[Depends(permissions.update())],
    status_code=status.HTTP_200_OK,
)
def assign_territories(
    user_id: Annotated[UUID, Path(description="The user UUID.")],
    body: schemas.TerritoryAssign,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Assign one or more territories to a user."""
    user_obj = crud.user.get(db_session, obj_id=user_id)
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    created = crud.territory.assign_to_user(
        db_session, user_id=user_id, territory_ids=body.territory_ids
    )
    return {"msg": f"Assigned {len(created)} territories to user.", "assigned": len(created)}


@router.post(
    "/users/{user_id}/remove",
    summary="Remove Territories from User",
    response_description="Confirmation message",
    dependencies=[Depends(permissions.update())],
    status_code=status.HTTP_200_OK,
)
def remove_territories(
    user_id: Annotated[UUID, Path(description="The user UUID.")],
    body: schemas.TerritoryRemove,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove territory assignments from a user."""
    removed = crud.territory.remove_from_user(
        db_session, user_id=user_id, territory_ids=body.territory_ids
    )
    return {"msg": f"Removed {removed} territory assignments.", "removed": removed}


@router.put(
    "/users/{user_id}/national-access",
    summary="Set National Access",
    response_description="Confirmation message",
    dependencies=[Depends(permissions.update())],
    status_code=status.HTTP_200_OK,
)
def set_national_access(
    user_id: Annotated[UUID, Path(description="The user UUID.")],
    body: schemas.NationalAccessUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Grant or revoke national access for a user (bypasses all territory filtering)."""
    user_obj = crud.user.get(db_session, obj_id=user_id)
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    crud.user.update(
        db_session,
        obj_id=user_id,
        obj_in={"national_access": body.national_access},
    )
    return {"msg": f"National access {'granted' if body.national_access else 'revoked'}."}
