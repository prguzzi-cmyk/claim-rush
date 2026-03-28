#!/usr/bin/env python

"""Routes for the Lead Files module"""

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
from app.schemas import LeadFileProcess
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.lead import process_lead_file, validate_lead_ownership
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.LEAD_FILE.value)
crud_util = CrudUtil(crud.lead_file)
crud_util_lead = CrudUtil(crud.lead)


@router.get(
    "/{lead_id}/files",
    summary="Read Lead Files",
    response_description="Lead files",
    response_model=CustomPage[schemas.LeadFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_files(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of lead files."""

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    return crud.lead_file.get_all(db_session, obj_id=lead_id)


@router.get(
    "/files/{lead_file_id}",
    summary="Read Lead File By Id",
    response_description="Lead file data",
    response_model=schemas.LeadFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_file_by_id(
    lead_file_id: Annotated[UUID, Path(description="Lead file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a lead file by an id."""

    # Get a lead file or raise an exception
    lead_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=lead_file_id
    )

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead_file.lead_id,
        exception_msg="This lead does not belong to you.",
    )

    return lead_file


@router.post(
    "/{lead_id}/files",
    summary="Create Lead File",
    response_description="Lead File created",
    response_model=schemas.LeadFile,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_lead_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[
        str | None, Form(max_length=255, description="File name.")
    ] = None,
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new lead file."""

    UserContext.set(current_user.id)

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    file_util = FileUtil()

    filenames = file_util.get_formatted_filenames(
        related_type=FileModules.LEAD,
        filename=file.filename,
        obj_id=lead.id,
        proposed_filename=file_name,
    )

    file_obj = LeadFileProcess(
        lead_id=lead.id,
        name=filenames["filename"],
        slugged_name=filenames["slugged_filename"],
        content=await file.read(),
        type=file.content_type,
        size=file.size,
        description=description,
        can_be_removed=can_be_removed,
    )

    return process_lead_file(file_obj, db_session)


@router.put(
    "/files/{lead_file_id}",
    summary="Update Lead File",
    response_description="Updated lead file",
    response_model=schemas.LeadFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead_file(
    lead_file_id: Annotated[UUID, Path(description="Lead file ID.")],
    lead_file_in: schemas.LeadFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a lead file via an ID."""

    UserContext.set(current_user.id)

    # Get a lead file or raise an exception
    lead_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=lead_file_id
    )

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(
        db_session, object_id=lead_file.lead_id
    )

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    lead_file = crud.file.update(db_session, file_id=lead_file_id, obj_in=lead_file_in)

    return lead_file


@router.delete(
    "/files/{lead_file_id}",
    summary="Remove Lead File",
    response_description="Lead File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead_file(
    lead_file_id: Annotated[UUID, Path(description="Lead file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a lead file by providing an ID."""

    # Get a lead file or raise an exception
    lead_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=lead_file_id
    )

    ext = get_file_extension(lead_file_obj.path)
    object_name = f"{settings.LEAD_FILE_DIR_PATH}/{slugify(lead_file_obj.name)}{ext}"

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.lead_file.remove(db_session, obj_id=lead_file_id)

    return {"msg": "File deleted successfully."}
