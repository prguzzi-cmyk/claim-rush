#!/usr/bin/env python

"""Routes for the Client Files module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.enums import FileModules
from app.core.log import logger
from app.core.rbac import Modules
from app.schemas import ClientFileProcess
from app.utils.client import process_client_file, validate_client_ownership
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.CLIENT_FILE.value)
crud_util = CrudUtil(crud.client_file)
crud_util_client = CrudUtil(crud.client)


@router.get(
    "/{client_id}/files",
    summary="Read Client Files",
    response_description="Client files",
    response_model=CustomPage[schemas.ClientFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_files(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of client files."""

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    return crud.client_file.get_all(db_session, obj_id=client_id)


@router.get(
    "/files/{client_file_id}",
    summary="Read Client File By Id",
    response_description="Client file data",
    response_model=schemas.ClientFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_file_by_id(
    client_file_id: Annotated[UUID, Path(description="Client file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a client file by an id."""

    # Get a client file or raise an exception
    client_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_file_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client_file.client_id,
        exception_msg="This client does not belong to you.",
    )

    return client_file


@router.post(
    "/{client_id}/files",
    summary="Create Client File",
    response_description="Client File created",
    response_model=schemas.ClientFile,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_client_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    client_id: Annotated[UUID, Path(description="The client ID.")],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[
        str | None, Form(max_length=255, description="File name.")
    ] = None,
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new client file."""

    UserContext.set(current_user.id)

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    file_util = FileUtil()

    filenames = file_util.get_formatted_filenames(
        related_type=FileModules.CLIENT,
        filename=file.filename,
        obj_id=client.id,
        proposed_filename=file_name,
    )

    file_obj = ClientFileProcess(
        client_id=client.id,
        name=filenames["filename"],
        slugged_name=filenames["slugged_filename"],
        content=await file.read(),
        type=file.content_type,
        size=file.size,
        description=description,
        can_be_removed=can_be_removed,
    )

    return process_client_file(file_obj, db_session)


@router.put(
    "/files/{client_file_id}",
    summary="Update Client File",
    response_description="Updated client file",
    response_model=schemas.ClientFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_client_file(
    client_file_id: Annotated[UUID, Path(description="Client file ID.")],
    client_file_in: schemas.ClientFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a client file via an ID."""

    UserContext.set(current_user.id)

    # Get a client file or raise an exception
    client_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_file_id
    )

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_file.client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    client_file = crud.file.update(
        db_session, file_id=client_file_id, obj_in=client_file_in
    )

    return client_file


@router.delete(
    "/files/{client_file_id}",
    summary="Remove Client File",
    response_description="Client File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_client_file(
    client_file_id: Annotated[UUID, Path(description="Client file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a client file by providing an ID."""

    # Get a client file or raise an exception
    client_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_file_id
    )

    ext = get_file_extension(client_file_obj.path)
    object_name = (
        f"{settings.CLIENT_FILE_DIR_PATH}/{slugify(client_file_obj.name)}{ext}"
    )

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.client_file.remove(db_session, obj_id=client_file_id)

    return {"msg": "File deleted successfully."}
