#!/usr/bin/env python

"""Routes for the Claim Files module"""

from functools import partial
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
from app.core.enums import ClaimActivityType, FileModules
from app.core.log import logger
from app.core.rbac import Modules, Operations
from app.schemas import ClaimFileProcess
from app.utils.claim import (
    process_claim_file,
    validate_claim_ownership,
    validate_claim_role,
)
from app.utils.common import get_file_extension, remove_domain_from_path, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

module = Modules.CLAIM_FILE
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim_file)
crud_util_claim = CrudUtil(crud.claim)
resource_exc_msg = "You do not have permission to modify this claim file."


@router.get(
    "/{claim_id}/files",
    summary="Read Claim Files",
    response_description="Claim files",
    response_model=CustomPage[schemas.ClaimFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_files(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of claim files."""

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    # Sales rep and client users can only see shared files
    filters = None
    if current_user.role and current_user.role.name in ("sales-rep", "client"):
        from app.models import File
        filters = [File.visibility == "shared"]

    return crud.claim_file.get_records(db_session, obj_id=claim_id, filters=filters)


@router.get(
    "/files/{claim_file_id}",
    summary="Read Claim File By Id",
    response_description="Claim file data",
    response_model=schemas.ClaimFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_file_by_id(
    claim_file_id: Annotated[UUID, Path(description="Claim file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim file by an id."""

    # Get a claim file or raise an exception
    claim_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_file_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_file.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    return claim_file


@router.post(
    "/{claim_id}/files",
    summary="Create Claim File",
    response_description="Claim File created",
    response_model=schemas.ClaimFile,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_claim_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[
        str | None, Form(max_length=255, description="File name.")
    ] = None,
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
    visibility: Annotated[
        str | None, Form(description="File visibility: internal or shared.")
    ] = "internal",
) -> Any:
    """Create a new claim file."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.CREATE,
    )

    file_util = FileUtil()

    filenames = file_util.get_formatted_filenames(
        related_type=FileModules.CLAIM,
        filename=file.filename,
        obj_id=claim.id,
        proposed_filename=file_name,
    )

    content = await file.read()
    file_size = file.size if file.size else len(content)

    logger.info(
        "Creating claim file: claim_id=%s, filename=%s, type=%s, size=%d",
        claim_id,
        filenames["filename"],
        file.content_type,
        file_size,
    )

    file_obj = ClaimFileProcess(
        claim_id=claim.id,
        name=filenames["filename"],
        slugged_name=filenames["slugged_filename"],
        content=content,
        type=file.content_type,
        size=file_size,
        description=description,
        can_be_removed=can_be_removed,
        visibility=visibility or "internal",
    )

    result = process_claim_file(file_obj, db_session)

    crud.claim.create_activity(
        db_session, claim, ClaimActivityType.DOCUMENT_UPLOADED,
        extra_details=f"File: {filenames['filename']}"
    )

    return result


@router.post(
    "/{claim_id}/files/fix-metadata",
    summary="Fix Files Metadata",
    response_description="Response Message",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user),
        Depends(permissions.read()),
    ],
)
def fix_claim_files_metadata(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Fix metadata of all files of a claim."""

    # Get a claim or raise an exception
    crud_util_claim.get_object_or_raise_exception(db_session, object_id=claim_id)

    claim_files = crud.claim_file.get_records(
        db_session, obj_id=claim_id, paginated=False
    )
    for file in claim_files:
        file_path = remove_domain_from_path(file.path)[1:]
        file_metadata = S3.get_metadata(file_path)
        if file_metadata:
            file_metadata["Content-Type"] = file.type
        else:
            file_metadata = {"Content-Type": file.type}

        S3.copy_file_obj(
            source_object_key=file_path,
            destination_object_key=file_path,
            metadata=file_metadata,
        )

    return {"msg": "Request processed successfully."}


@router.post(
    "/{claim_id}/files/fix-slug-name",
    summary="Fix Files Slug Name",
    response_description="Response Message",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user),
        Depends(permissions.read()),
    ],
)
def fix_claim_files_slug_name(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Fix slug name of all files of a claim."""

    # Get a claim or raise an exception
    crud_util_claim.get_object_or_raise_exception(db_session, object_id=claim_id)

    claim_files = crud.claim_file.get_records(
        db_session, obj_id=claim_id, paginated=False
    )
    for file in claim_files:
        file_util = FileUtil()
        file_util.fix_file_slug_name(obj=file)

    return {"msg": "Request processed successfully."}


@router.put(
    "/files/{claim_file_id}",
    summary="Update Claim File",
    response_description="Updated claim file",
    response_model=schemas.ClaimFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim_file(
    claim_file_id: Annotated[UUID, Path(description="Claim file ID.")],
    claim_file_in: schemas.ClaimFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim file via an ID."""

    UserContext.set(current_user.id)

    # Get a claim file or raise an exception
    claim_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_file_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_file.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.UPDATE,
        resource=claim_file,
        resource_exc_msg=resource_exc_msg,
    )

    claim_file = crud.file.update(
        db_session, file_id=claim_file_id, obj_in=claim_file_in
    )

    return claim_file


@router.delete(
    "/files/{claim_file_id}",
    summary="Remove Claim File",
    response_description="Claim File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim_file(
    claim_file_id: Annotated[UUID, Path(description="Claim file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim file by providing an ID."""

    # Get a claim file or raise an exception
    claim_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_file_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_file_obj.claim_id
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.REMOVE,
        resource=claim_file_obj,
        resource_exc_msg=resource_exc_msg,
    )

    ext = get_file_extension(claim_file_obj.path)
    object_name = f"{settings.CLAIM_FILE_DIR_PATH}/{slugify(claim_file_obj.name)}{ext}"

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.claim_file.remove(db_session, obj_id=claim_file_id)

    return {"msg": "File deleted successfully."}
