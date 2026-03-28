#!/usr/bin/env python

"""Routes for the Estimate Photos module"""

import uuid as uuid_mod
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, Query, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_bad_request, exc_internal_server
from app.utils.s3 import S3

router = APIRouter()

module = Modules.ESTIMATE_PROJECT
permissions = Permissions(module.value)
crud_util_project = CrudUtil(crud.estimate_project)
crud_util_photo = CrudUtil(crud.estimate_photo)


@router.post(
    "/{project_id}/photos",
    summary="Upload Estimate Photo",
    response_description="Uploaded photo record",
    response_model=schemas.EstimatePhoto,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_estimate_photo(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Photo file (JPEG or PNG).")],
    photo_type: Annotated[str | None, Form(description="Photo type.")] = None,
    caption: Annotated[str | None, Form(description="Optional caption.")] = None,
    room_id: Annotated[str | None, Form(description="Optional room UUID.")] = None,
) -> Any:
    """Upload a photo for an estimate project, optionally associated with a room."""

    UserContext.set(current_user.id)

    # Validate file type
    if file.content_type not in settings.WHITELISTED_IMAGE_TYPES:
        exc_bad_request(
            f"Invalid file type '{file.content_type}'. "
            f"Only {settings.WHITELISTED_IMAGE_TYPES} are allowed.",
        )

    # Ensure the project exists
    crud_util_project.get_object_or_raise_exception(
        db_session, object_id=project_id
    )

    # Build S3 key
    ext = get_file_extension(file.filename) if file.filename else ""
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{settings.ESTIMATE_PHOTO_DIR_PATH}/{project_id}/{unique_name}"
    file_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{storage_key}"

    try:
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.error(e)
        exc_internal_server("An error occurred while uploading the photo.")

    # Parse room_id from string if provided
    parsed_room_id = UUID(room_id) if room_id else None

    photo_in = schemas.EstimatePhotoCreate(
        image_url=file_url,
        caption=caption,
        photo_type=photo_type,
        project_id=project_id,
        room_id=parsed_room_id,
    )

    return crud.estimate_photo.create(db_session, obj_in=photo_in)


@router.get(
    "/{project_id}/photos",
    summary="List Estimate Photos",
    response_description="List of photos for the project",
    response_model=list[schemas.EstimatePhoto],
    dependencies=[Depends(permissions.read())],
)
def list_estimate_photos(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    room_id: Annotated[UUID | None, Query(description="Filter by room ID.")] = None,
) -> Any:
    """List photos for an estimate project, optionally filtered by room."""

    return crud.estimate_photo.get_by_project(
        db_session, project_id=project_id, room_id=room_id
    )


@router.put(
    "/photos/{photo_id}",
    summary="Update Estimate Photo",
    response_description="Updated photo record",
    response_model=schemas.EstimatePhoto,
    dependencies=[Depends(permissions.update())],
)
def update_estimate_photo(
    photo_id: Annotated[UUID, Path(description="The photo ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    photo_in: schemas.EstimatePhotoUpdate,
) -> Any:
    """Update a photo's caption, type, or AI tags."""

    photo_obj = crud_util_photo.get_object_or_raise_exception(
        db_session, object_id=photo_id
    )

    return crud.estimate_photo.update(
        db_session, db_obj=photo_obj, obj_in=photo_in
    )


@router.delete(
    "/photos/{photo_id}",
    summary="Delete Estimate Photo",
    response_description="Deletion confirmation",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def delete_estimate_photo(
    photo_id: Annotated[UUID, Path(description="The photo ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Delete a photo from the database and S3."""

    photo_obj = crud_util_photo.get_object_or_raise_exception(
        db_session, object_id=photo_id
    )

    # Extract S3 key from image_url
    base_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/"
    storage_key = photo_obj.image_url.replace(base_url, "") if photo_obj.image_url else None

    if storage_key:
        try:
            S3.delete_file_obj(object_name=storage_key)
        except Exception as e:
            logger.error(e)

    crud.estimate_photo.hard_remove(db_session, obj_id=photo_id)

    return {"msg": "Photo deleted successfully."}
