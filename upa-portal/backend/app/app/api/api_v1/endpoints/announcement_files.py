#!/usr/bin/env python

"""Routes for the Announcement Files module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import (
    Permissions,
    at_least_admin_user,
    get_current_active_user,
    get_db_session,
)
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.schemas import AnnouncementFileCreate
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.ANNOUNCEMENT_FILE.value)
crud_util = CrudUtil(crud.announcement_file)
crud_util_announcement = CrudUtil(crud.announcement)


@router.get(
    "/{announcement_id}/files",
    summary="Read Announcement Files",
    response_description="Announcement files",
    response_model=CustomPage[schemas.AnnouncementFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_announcement_files(
    announcement_id: Annotated[UUID, Path(description="The announcement ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of announcement files."""

    # Get an announcement or raise an exception
    crud_util_announcement.get_object_or_raise_exception(
        db_session, object_id=announcement_id
    )

    return crud.announcement_file.get_all(db_session, obj_id=announcement_id)


@router.get(
    "/files/{announcement_file_id}",
    summary="Read Announcement File By Id",
    response_description="Announcement file data",
    response_model=schemas.AnnouncementFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_announcement_file_by_id(
    announcement_file_id: Annotated[UUID, Path(description="Announcement file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve an announcement file by an id."""

    # Get an announcement file or raise an exception
    announcement_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=announcement_file_id
    )

    return announcement_file


@router.post(
    "/{announcement_id}/files",
    summary="Create Announcement File",
    response_description="Announcement File created",
    response_model=schemas.AnnouncementFile,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_announcement_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    announcement_id: Annotated[UUID, Path(description="The announcement ID.")],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[str, Form(max_length=255, description="File name.")],
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new announcement file."""

    UserContext.set(current_user.id)

    # Get an announcement or raise an exception
    crud_util_announcement.get_object_or_raise_exception(
        db_session, object_id=announcement_id
    )

    # Create a file record in the database
    ext = get_file_extension(file.filename)
    object_name = (
        f"{settings.ANNOUNCEMENT_FILE_DIR_PATH}/"
        f"{announcement_id}/{slugify(file_name)}{ext}"
    )

    file_path = (
        f"{settings.ANNOUNCEMENT_FILE_URL_PATH}/"
        f"{announcement_id}/{slugify(file_name)}{ext}"
    )

    file_in = AnnouncementFileCreate(
        announcement_id=announcement_id,
        name=file_name,
        type=file.content_type,
        size=file.size,
        path=file_path,
        description=description,
        can_be_removed=can_be_removed,
    )

    file_obj = crud.announcement_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        file.file.seek(0)

        S3.upload_file_obj(file=file, object_name=object_name)

        return file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if file_obj:
            crud.announcement_file.remove(db_session, obj_id=file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")


@router.put(
    "/files/{announcement_file_id}",
    summary="Update Announcement File",
    response_description="Updated announcement file",
    response_model=schemas.AnnouncementFile,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_announcement_file(
    announcement_file_id: Annotated[UUID, Path(description="Announcement file ID.")],
    announcement_file_in: schemas.AnnouncementFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an announcement file via an ID."""

    UserContext.set(current_user.id)

    # Get an announcement file or raise an exception
    announcement_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=announcement_file_id
    )

    # Get an announcement or raise an exception
    crud_util_announcement.get_object_or_raise_exception(
        db_session, object_id=announcement_file.announcement_id
    )

    announcement_file = crud.file.update(
        db_session, file_id=announcement_file_id, obj_in=announcement_file_in
    )

    return announcement_file


@router.delete(
    "/files/{announcement_file_id}",
    summary="Remove Announcement File",
    response_description="Announcement File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_announcement_file(
    announcement_file_id: Annotated[UUID, Path(description="Announcement file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove an announcement file by providing an ID."""

    # Get an announcement file or raise an exception
    announcement_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=announcement_file_id
    )

    ext = get_file_extension(announcement_file_obj.path)
    object_name = (
        f"{settings.ANNOUNCEMENT_FILE_DIR_PATH}/"
        f"{slugify(announcement_file_obj.name)}{ext}"
    )

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.announcement_file.remove(db_session, obj_id=announcement_file_id)

    return {"msg": "File deleted successfully."}
