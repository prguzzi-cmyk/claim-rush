#!/usr/bin/env python

"""Routes for the User Task module"""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions
from app.core.rbac import Modules
from app.utils.contexts import UserContext

router = APIRouter()

permissions = Permissions(Modules.USER_ACTIVITY.value)


@router.post(
    "",
    summary="Create User Activity",
    response_description="User activity created",
    response_model=schemas.UserActivity,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_user_activity(
    user_activity_in: schemas.UserActivityCreate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Create a new user activity."""

    UserContext.set(current_user.id)

    obj_in = {
        **user_activity_in.dict(),
        "user_id": current_user.id,
        "timestamp": datetime.now(),
    }

    user_activity = crud.user_activity.create(db_session, obj_in=obj_in)

    return user_activity
