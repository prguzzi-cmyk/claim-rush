#!/usr/bin/env python

"""Routes for the Claim Payment Files module"""

from functools import partial
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import (
    Permissions,
    get_current_active_user,
    get_db_session,
)
from app.core.config import settings
from app.core.enums import FileModules
from app.core.log import logger
from app.core.rbac import Modules, Operations
from app.schemas import ClaimPaymentFileProcess
from app.utils.claim import (
    validate_claim_ownership,
    validate_claim_role,
)
from app.utils.claim_payment import process_claim_payment_file
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()

module = Modules.CLAIM_PAYMENT_FILE
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim_payment_file)
crud_util_claim_payment = CrudUtil(crud.claim_payment)
resource_exc_msg = "You do not have permission to modify this claim payment file."


@router.get(
    "/{payment_id}/files",
    summary="Read Claim Payment Files",
    response_description="Claim Payment files",
    response_model=CustomPage[schemas.ClaimPaymentFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_payment_files(
    payment_id: Annotated[UUID, Path(description="The payment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of claim payment files."""

    # Get a claim payment or raise an exception
    claim_payment: models.claim_payment = (
        crud_util_claim_payment.get_object_or_raise_exception(
            db_session, object_id=payment_id
        )
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim_payment.claim_id,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim_payment.claim,
    )

    return crud.claim_payment_file.get_records(db_session, obj_id=payment_id)


@router.get(
    "/files/{claim_payment_file_id}",
    summary="Read Claim Payment File By Id",
    response_description="Claim Payment file data",
    response_model=schemas.ClaimPaymentFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_payment_file_by_id(
    claim_payment_file_id: Annotated[UUID, Path(description="Claim Payment file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim payment file by an id."""

    # Get a claim payment file or raise an exception
    claim_payment_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file_id
    )

    # Get a claim payment or raise an exception
    claim_payment = crud_util_claim_payment.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file.payment_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim_payment.claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim_payment.claim,
    )

    return claim_payment_file


@router.post(
    "/{payment_id}/files",
    summary="Create Claim Payment Files",
    response_description="Claim Payment Files created",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_claim_payment_files(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    payment_id: Annotated[UUID, Path(description="The payment ID.")],
    files: Annotated[list[UploadFile], File(description="Uploaded files.")],
    file_names: Annotated[
        list[str] | None, Form(max_length=255, description="Files names.")
    ] = None,
    descriptions: Annotated[
        list[str] | None, Form(description="Files descriptions.")
    ] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create claim payment files."""

    UserContext.set(current_user.id)

    # Get a claim payment or raise an exception
    claim_payment = crud_util_claim_payment.get_object_or_raise_exception(
        db_session, object_id=payment_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim_payment.claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim_payment.claim,
        operation=Operations.CREATE,
    )

    file_util = FileUtil()
    try:
        for i, file in enumerate(files):
            filenames = file_util.get_formatted_filenames(
                related_type=FileModules.CLAIM_PAYMENT,
                filename=file.filename,
                obj_id=payment_id,
                proposed_filename=(
                    file_names[i] if file_names and file_names[i] else None
                ),
            )

            file_obj = ClaimPaymentFileProcess(
                payment_id=payment_id,
                name=filenames["filename"],
                slugged_name=filenames["slugged_filename"],
                content=await file.read(),
                type=file.content_type,
                size=file.size,
                description=(
                    descriptions[i] if descriptions and descriptions[i] else None
                ),
                can_be_removed=can_be_removed,
            )

            process_claim_payment_file(file_obj, db_session)

        return {"msg": "Files are created successfully."}
    except Exception as e:
        logger.error(e)
        exc_internal_server("Some error occurred.")


@router.put(
    "/files/{claim_payment_file_id}",
    summary="Update Claim Payment File",
    response_description="Updated claim payment file",
    response_model=schemas.ClaimPaymentFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim_payment_file(
    claim_payment_file_id: Annotated[UUID, Path(description="Claim Payment file ID.")],
    claim_payment_file_in: schemas.ClaimPaymentFileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim payment file via an ID."""

    UserContext.set(current_user.id)

    # Get a claim payment file or raise an exception
    claim_payment_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file_id
    )

    # Get a claim payment or raise an exception
    claim_payment = crud_util_claim_payment.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file.payment_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim_payment.claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim_payment.claim,
        operation=Operations.UPDATE,
        resource=claim_payment_file,
        resource_exc_msg=resource_exc_msg,
    )

    claim_payment_file = crud.file.update(
        db_session, file_id=claim_payment_file_id, obj_in=claim_payment_file_in
    )

    return claim_payment_file


@router.delete(
    "/files/{claim_payment_file_id}",
    summary="Remove Claim Payment File",
    response_description="Claim Payment File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim_payment_file(
    claim_payment_file_id: Annotated[UUID, Path(description="Claim Payment file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim payment file by providing an ID."""

    # Get a claim payment file or raise an exception
    claim_payment_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file_id
    )

    # Get a claim payment or raise an exception
    claim_payment = crud_util_claim_payment.get_object_or_raise_exception(
        db_session, object_id=claim_payment_file_obj.payment_id
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim_payment.claim,
        user=current_user,
        operation=Operations.REMOVE,
        resource=claim_payment_file_obj,
        resource_exc_msg=resource_exc_msg,
    )

    ext = get_file_extension(claim_payment_file_obj.path)
    object_name = f"{settings.CLAIM_PAYMENT_FILE_DIR_PATH}/{slugify(claim_payment_file_obj.name)}{ext}"

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.claim_payment_file.remove(db_session, obj_id=claim_payment_file_id)

    return {"msg": "File deleted successfully."}
