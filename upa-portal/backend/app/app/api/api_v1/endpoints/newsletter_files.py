#!/usr/bin/env python

"""Routes for the Newsletter Files module"""

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
from app.schemas import NewsletterFileCreate
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.NEWSLETTER_FILE.value)
crud_util = CrudUtil(crud.newsletter_file)
crud_util_newsletter = CrudUtil(crud.newsletter)


@router.get(
    "/{newsletter_id}/files",
    summary="Read Newsletter Files",
    response_description="Newsletter files",
    response_model=CustomPage[schemas.NewsletterFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_newsletter_files(
    newsletter_id: Annotated[UUID, Path(description="The newsletter ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of newsletter files."""

    # Get a newsletter or raise an exception
    crud_util_newsletter.get_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    return crud.newsletter_file.get_all(db_session, obj_id=newsletter_id)


@router.get(
    "/files/{newsletter_file_id}",
    summary="Read Newsletter File By Id",
    response_description="Newsletter file data",
    response_model=schemas.NewsletterFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_newsletter_file_by_id(
    newsletter_file_id: Annotated[UUID, Path(description="Newsletter file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a newsletter file by an id."""

    # Get a newsletter file or raise an exception
    newsletter_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_file_id
    )

    return newsletter_file


@router.post(
    "/{newsletter_id}/files",
    summary="Create Newsletter File",
    response_description="Newsletter File created",
    response_model=schemas.NewsletterFile,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_newsletter_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    newsletter_id: Annotated[UUID, Path(description="The newsletter ID.")],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[str, Form(max_length=255, description="File name.")],
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new newsletter file."""

    UserContext.set(current_user.id)

    # Get a newsletter or raise an exception
    crud_util_newsletter.get_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    # Create a file record in the database
    ext = get_file_extension(file.filename)
    object_name = (
        f"{settings.NEWSLETTER_FILE_DIR_PATH}/{newsletter_id}/{slugify(file_name)}{ext}"
    )

    file_path = (
        f"{settings.NEWSLETTER_FILE_URL_PATH}/{newsletter_id}/{slugify(file_name)}{ext}"
    )

    file_in = NewsletterFileCreate(
        newsletter_id=newsletter_id,
        name=file_name,
        type=file.content_type,
        size=file.size,
        path=file_path,
        description=description,
        can_be_removed=can_be_removed,
    )

    file_obj = crud.newsletter_file.create(db_session, obj_in=file_in)

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
            crud.newsletter_file.remove(db_session, obj_id=file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")


@router.put(
    "/files/{newsletter_file_id}",
    summary="Update Newsletter File",
    response_description="Updated newsletter file",
    response_model=schemas.NewsletterFile,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_newsletter_file(
    newsletter_file_id: Annotated[UUID, Path(description="Newsletter file ID.")],
    newsletter_file_in: schemas.NewsletterFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a newsletter file via an ID."""

    UserContext.set(current_user.id)

    # Get a newsletter file or raise an exception
    newsletter_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_file_id
    )

    # Get a newsletter or raise an exception
    crud_util_newsletter.get_object_or_raise_exception(
        db_session, object_id=newsletter_file.newsletter_id
    )

    newsletter_file = crud.file.update(
        db_session, file_id=newsletter_file_id, obj_in=newsletter_file_in
    )

    return newsletter_file


@router.delete(
    "/files/{newsletter_file_id}",
    summary="Remove Newsletter File",
    response_description="Newsletter File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_newsletter_file(
    newsletter_file_id: Annotated[UUID, Path(description="Newsletter file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a newsletter file by providing an ID."""

    # Get a newsletter file or raise an exception
    newsletter_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_file_id
    )

    ext = get_file_extension(newsletter_file_obj.path)
    object_name = (
        f"{settings.NEWSLETTER_FILE_DIR_PATH}/{slugify(newsletter_file_obj.name)}{ext}"
    )

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.newsletter_file.remove(db_session, obj_id=newsletter_file_id)

    return {"msg": "File deleted successfully."}
