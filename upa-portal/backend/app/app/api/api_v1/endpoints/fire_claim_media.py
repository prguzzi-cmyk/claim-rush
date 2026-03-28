#!/usr/bin/env python

"""Routes for the Fire Claim Media module"""

import uuid as uuid_mod
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.s3 import S3

router = APIRouter()

module = Modules.FIRE_CLAIM_MEDIA
permissions = Permissions(module.value)
crud_util_claim = CrudUtil(crud.fire_claim)
crud_util_media = CrudUtil(crud.fire_claim_media)


@router.post(
    "/{fire_claim_id}/media",
    summary="Upload Fire Claim Media",
    response_description="Uploaded media record",
    response_model=schemas.FireClaimMedia,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_fire_claim_media(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Photo or video file.")],
    media_type: Annotated[str, Form(description="'photo' or 'video'.")] = "photo",
    caption: Annotated[str | None, Form(description="Optional caption.")] = None,
) -> Any:
    """Upload a photo or video for a fire claim."""

    UserContext.set(current_user.id)

    # Ensure the fire claim exists
    crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )

    # Build S3 key
    ext = get_file_extension(file.filename) if file.filename else ""
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{settings.FIRE_CLAIM_FILE_DIR_PATH}/{fire_claim_id}/{unique_name}"
    file_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{storage_key}"

    try:
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.error(e)
        exc_internal_server("An error occurred while uploading the file.")

    media_in = schemas.FireClaimMediaCreate(
        fire_claim_id=fire_claim_id,
        media_type=media_type,
        storage_key=storage_key,
        file_url=file_url,
        caption=caption,
    )

    return crud.fire_claim_media.create(db_session, obj_in=media_in)


@router.delete(
    "/{fire_claim_id}/media/{media_id}",
    summary="Delete Fire Claim Media",
    response_description="Deletion confirmation",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def delete_fire_claim_media(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    media_id: Annotated[UUID, Path(description="The media ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Delete a media item from a fire claim and remove from S3."""

    # Ensure fire claim exists
    crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )

    # Get the media record
    media_obj = crud_util_media.get_object_or_raise_exception(
        db_session, object_id=media_id
    )

    # Delete from S3
    try:
        S3.delete_file_obj(object_name=media_obj.storage_key)
    except Exception as e:
        logger.error(e)

    # Hard delete from DB
    crud.fire_claim_media.hard_remove(db_session, obj_id=media_id)

    return {"msg": "Media deleted successfully."}
