#!/usr/bin/env python

"""Routes for the announcements module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import AnnouncementSearch, AnnouncementSort, Ordering
from app.models import Announcement
from app.models import Announcement as AnnouncementModel
from app.models import AnnouncementActivity, User
from app.utils.announcement import validate_dates
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.ANNOUNCEMENT.value)
crud_util = CrudUtil(crud.announcement)
read_params = CommonReadParams(AnnouncementSearch, AnnouncementSort)
stmt_gen = SqlStmtGenerator(AnnouncementModel)


@router.get(
    "",
    summary="Read Announcements",
    response_description="A list of announcements",
    response_model=CustomPage[schemas.Announcement],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_announcements(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = AnnouncementSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of Announcements."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    announcements = crud.announcement.get_multi(
        db_session,
        join_target=Announcement.announcement_activities.and_(
            AnnouncementActivity.user_id == current_user.id
        ),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return announcements


@router.get(
    "/{announcement_id}",
    summary="Read Announcement By Id",
    response_description="Announcement data",
    response_model=schemas.Announcement,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_announcement_by_id(
    announcement_id: Annotated[UUID, Path(description="The announcement id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve an announcement by an id"""

    # Get a announcement or raise an exception
    announcement = crud_util.get_object_or_raise_exception(
        db_session, object_id=announcement_id
    )

    return announcement


@router.post(
    "",
    summary="Create Announcement",
    response_description="Announcement created",
    response_model=schemas.Announcement,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    announcement_in: schemas.AnnouncementCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Create a new announcement."""

    UserContext.set(current_user.id)

    # Validate announcement date and expiration date
    validate_dates(obj_in=announcement_in)

    announcement_obj = crud.announcement.create(db_session, obj_in=announcement_in)

    # Trigger async notification to all active users
    from app.core.celery_app import celery_app

    content_preview = (announcement_obj.content or "")[:200]
    celery_app.send_task(
        "app.tasks.lead_delivery.notify_announcement",
        args=[
            str(announcement_obj.id),
            announcement_obj.title,
            content_preview,
            str(current_user.id),
        ],
    )

    return announcement_obj


@router.put(
    "/{announcement_id}",
    summary="Update Announcement",
    response_description="Updated announcement data",
    response_model=schemas.Announcement,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_announcement(
    announcement_id: Annotated[UUID, Path(description="The announcement id.")],
    announcement_in: schemas.AnnouncementUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Update an announcement via an ID"""

    UserContext.set(current_user.id)

    # Get an announcement or raise an exception
    announcement_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=announcement_id
    )

    # Validate announcement date and expiration date
    validate_dates(obj_in=announcement_in, db_obj=announcement_obj)

    announcement = crud.announcement.update(
        db_session, announcement_id=announcement_id, obj_in=announcement_in
    )

    return announcement


@router.patch(
    "/{announcement_id}/restore",
    summary="Restore Announcement",
    response_description="Restored Announcement data",
    response_model=schemas.Announcement,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_announcement(
    announcement_id: Annotated[UUID, Path(description="The Announcement ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Restore an announcement via an ID."""

    UserContext.set(current_user.id)

    # Get an announcement or raise an exception
    announcement = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=announcement_id
    )

    announcement = crud.announcement.restore(db_session, db_obj=announcement)

    return announcement


@router.delete(
    "/{announcement_id}",
    summary="Remove Announcement",
    response_description="Announcement removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_announcement(
    announcement_id: Annotated[UUID, Path(description="The announcement id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove an announcement by providing an ID"""

    # Get an announcement or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=announcement_id)

    crud.announcement.remove(db_session, obj_id=announcement_id)

    return {"msg": "Announcement deleted successfully."}
