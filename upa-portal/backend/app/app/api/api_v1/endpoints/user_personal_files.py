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
from app.models.user_personal_file import UserPersonalFile
from app.schemas import UserPersonalFileProcess
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3
from app.utils.user_personal_file import process_user_personal_file

router = APIRouter()

permissions = Permissions(Modules.USER_PERSONAL_FILE.value)
crud_util_user_personal_file = CrudUtil(crud.user_personal_file)


@router.get(
    "",
    summary="Read User Personal Files",
    response_description="User Personal files",
    response_model=CustomPage[schemas.UserPersonalFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_user_personal_files(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of lead files."""
    return crud.user_personal_file.get_all(db_session, owner_id=current_user.id)



@router.post(
    "",
    summary="Create User Personal Files",
    response_description="User Personal File created",
    response_model=schemas.UserPersonalFile,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_user_personal_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[
        str | None, Form(max_length=255, description="File name.")
    ] = None,
    state: Annotated[str | None, Form(description="state.")] = None,
    expiration_date: Annotated[str | None, Form(description="expiration_date.")] = None,
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new user's personal file."""

    UserContext.set(current_user.id)

    if state is None:
        state="None"

    if expiration_date is None:
        expiration_date = "None"

    file_util = FileUtil()
    filenames = file_util.get_formatted_filenames(
        related_type=FileModules.PERSONAL_FILE,
        filename=file.filename,
        obj_id=current_user.id,
        proposed_filename=file_name,
    )

    file_obj = UserPersonalFileProcess(
        owner_id=current_user.id,
        name=filenames["filename"],
        slugged_name=filenames["slugged_filename"],
        content=await file.read(),
        type=file.content_type,
        size=file.size,
        description=description,
        state = state,
        expiration_date = expiration_date,
        can_be_removed=can_be_removed,
    )

    return process_user_personal_file(file_obj, db_session)


@router.put(
    "/{file_id}",
    summary="Update Lead File",
    response_description="Updated lead file",
    response_model=schemas.LeadFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead_file(
    file_id: Annotated[UUID, Path(description="Lead file ID.")],
    file_in: schemas.UserPersonalFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a lead file via an ID."""

    UserContext.set(current_user.id)

    # Get a lead file or raise an exception
    file_obj: UserPersonalFile = crud_util_user_personal_file.get_object_or_raise_exception(
        db_session, object_id=file_id
    )

    if file_obj.owner_id == current_user.id:
        new_personal_file = crud.file.update(db_session, file_id=file_id, obj_in=file_in)
        return new_personal_file
    else:
        return {"msg": "File cannot be updated as you're not the owner."}


@router.delete(
    "/{file_id}",
    summary="Remove User Personal File",
    response_description="User Personal File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead_file(
    file_id: Annotated[UUID, Path(description="Lead file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a lead file by providing an ID."""

    # Get a lead file or raise an exception
    file_obj = crud_util_user_personal_file.get_object_or_raise_exception(
        db_session, object_id=file_id
    )

    ext = get_file_extension(file_obj.path)
    object_name = f"{settings.USER_PERSONAL_FILE_DIR_PATH}/{slugify(file_obj.name)}{ext}"

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.user_personal_file.remove(db_session, obj_id=file_id)

    return {"msg": "File deleted successfully."}
