#!/usr/bin/env python

"""Routes for the Announcement Activity module"""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions
from app.core.rbac import Modules
from app.schemas import AnnouncementActivityCreateDB
from app.utils.announcement import validate_activity_duplicity
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil

router = APIRouter()

permissions = Permissions(Modules.ANNOUNCEMENT_ACTIVITY.value)


@router.post(
    "/{announcement_id}/activities",
    summary="Create Announcement Activity",
    response_description="Announcement activity created",
    response_model=schemas.AnnouncementActivity,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_announcement_activity(
    announcement_id: Annotated[UUID, Path(description="The announcement ID.")],
    activity_in: schemas.AnnouncementActivityCreate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Create a new announcement activity."""

    UserContext.set(current_user.id)

    # Check if the provided item exists
    CrudUtil(crud.announcement).get_object_or_raise_exception(
        db_session,
        announcement_id,
        err_msg="The announcement with this ID does not exist in the system.",
    )

    obj_in = AnnouncementActivityCreateDB(
        **activity_in.dict(),
        announcement_id=announcement_id,
        user_id=current_user.id,
        timestamp=datetime.now()
    )

    # Validate duplicity of the record
    validate_activity_duplicity(db_session, obj_in)

    announcement_activity = crud.announcement_activity.create(db_session, obj_in=obj_in)

    return announcement_activity
