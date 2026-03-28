#!/usr/bin/env python

"""Routes for the Claim Files module"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.enums import ClaimFileShareType, RefTypes
from app.core.rbac import Modules
from app.utils.claim import validate_claim_ownership
from app.utils.common import convert_date_to_string, generate_ref_string
from app.utils.contexts import UserContext
from app.utils.emails import is_valid_attachment_size, send_claim_file_share_email
from app.utils.exceptions import CrudUtil
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.CLAIM_FILE_SHARE.value)
crud_util = CrudUtil(crud.claim_file)
crud_util_claim = CrudUtil(crud.claim)
crud_util_client = CrudUtil(crud.client)


crud_util_claim_file_share = CrudUtil(crud.crud_claim_file_share)


@router.post(
    "/files/share",
    summary="Share Claim Files",
    response_description="Claim Files Share created",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_200_OK,
)
def claim_files_share(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    request_model: schemas.ClaimFileShareCreate,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """Share claim files by providing a list of claim file ids."""
    UserContext.set(current_user.id)

    # File List
    file_list = []

    claim = None
    client_name = None
    claim_ref_num = None

    # Get a claim or raise an exception
    for claim_file_id in request_model.claim_file_ids:
        claim_file = crud_util.get_object_or_raise_exception(
            db_session, object_id=claim_file_id
        )

        if not claim:
            claim = crud_util_claim.get_object_or_raise_exception(
                db_session, object_id=claim_file.claim_id
            )

            claim_ref_num = generate_ref_string(RefTypes.CLAIM, str(claim.ref_number))

            client = crud_util_client.get_object_or_raise_exception(
                db_session, claim.client_id
            )

            client_name = client.full_name

        # Validate claim ownership
        validate_claim_ownership(
            db_session,
            user=current_user,
            claim_obj=claim,
            exception_msg="This claim does not belong to you.",
        )

        file_list.append(
            {
                "claim_id": claim_file.claim_id,
                "s3_key": f"claim-file/{claim_file.claim_id}/{claim_file.slugged_name}",
                "name": claim_file.name,
                "size": claim_file.size,
            }
        )

    # Call the CRUD function to create a new claim file share
    claim_file_share_obj = crud.crud_claim_file_share.create(
        db_session=db_session, obj_in=request_model
    )

    if request_model.share_type == ClaimFileShareType.SENT_AS_LINK:
        # Send files via link in email
        background_tasks.add_task(
            send_claim_file_share_email,
            to=",".join(request_model.email_files_to),
            sender=f"{current_user.first_name} {current_user.last_name}",
            client_name=client_name,
            claim_ref_num=claim_ref_num,
            sender_company=settings.PROJECT_NAME,
            link=str(claim_file_share_obj.id),
            message=request_model.message,
            sender_email=current_user.email,
            request=request,
            attachments=None,
        )

    elif request_model.share_type == ClaimFileShareType.SENT_AS_ATTACHMENT:
        # Send email with attachment

        # Check if the total size valid
        total_size = sum(file.get("size", 0) for file in file_list)
        if not is_valid_attachment_size(total_size):
            return {"msg": "Total attachment size should be less than 25 MB."}

        # Send email with attachments
        background_tasks.add_task(
            send_claim_file_share_email,
            attachments=[file["s3_key"] for file in file_list],
            to=",".join(request_model.email_files_to),
            sender=f"{current_user.first_name} {current_user.last_name}",
            client_name=client_name,
            claim_ref_num=claim_ref_num,
            sender_company=settings.PROJECT_NAME,
            message=request_model.message,
            sender_email=current_user.email,
            request=request,
            link=None,
        )

    else:
        return {"msg": "Invalid share_type given."}

    return {"msg": "Files shared successfully."}


@router.get(
    "/files/share/{share_id}",
    summary="Get download links",
    response_description="Shared Claim File download links",
    response_model=schemas.ClaimFileShareDownloadLinksResponse,
    status_code=status.HTTP_200_OK,
)
def claim_file_share_links(
    db_session: Annotated[Session, Depends(get_db_session)],
    share_id: Annotated[UUID, Path(description="Claim file Share ID.")],
):
    """Get all download links from a shared email link"""

    # Retrieve the claim file share record by ID or throw an exception if not found
    claim_file_share_obj = crud_util_claim_file_share.get_object_or_raise_exception(
        db_session=db_session,
        object_id=share_id,
    )

    # Extract the list of file IDs from the share entry
    claim_file_ids = crud.crud_claim_file_share_detail.get_file_ids_by_share_id(
        db_session=db_session,
        share_id=share_id,
    )

    # Prepare a list to store file information for generating download URLs
    file_list = []

    # Fetch each file associated with the share entry, or raise an exception if any file is not found
    for claim_file_id in claim_file_ids:
        claim_file = crud_util.get_object_or_raise_exception(
            db_session, object_id=claim_file_id
        )

        # Append the file details needed to construct paths for downloading
        file_list.append(
            {
                "claim_id": claim_file.claim_id,
                "s3_key": f"claim-file/{claim_file.claim_id}/{claim_file.slugged_name}",
                "name": claim_file.name,
                "size": claim_file.size,
            }
        )

    # Generate presigned URLs for individual file access
    presigned_urls = S3.get_presigned_urls(
        file_list,
        convert_date_to_string(
            claim_file_share_obj.expiration_date
        ),  # Convert datetime to string in ISO 8601 format
    )

    # Construct the response object with URLs for individual and zipped files
    response = schemas.ClaimFileShareDownloadLinksResponse(
        expiration_date=convert_date_to_string(claim_file_share_obj.expiration_date),
        files=presigned_urls,
    )

    return response


@router.get(
    "/files/share/{share_id}/download-all",
    summary="Download zipped claim files",
    responses={
        200: {
            "content": {"application/zip": {}},
            "description": "A zip file containing the requested claim files.",
        },
        404: {"description": "Claim file share not found."},
    },
    status_code=status.HTTP_200_OK,
    response_class=StreamingResponse,
)
def download_claim_file_share_zip(
    db_session: Annotated[Session, Depends(get_db_session)],
    share_id: Annotated[UUID, Path(description="Claim file Share ID.")],
):
    """Downloads all files related to a claim file share as a zip directly."""

    # Retrieve the claim file share record by ID or throw an exception if not found
    claim_file_share_obj = crud_util_claim_file_share.get_object_or_raise_exception(
        db_session=db_session, object_id=share_id
    )

    expiration_date = claim_file_share_obj.expiration_date

    today = datetime.now().date()  # Today's date (no time component)

    if expiration_date < today:
        # If the expiration date is before today, raise an HTTPException for FastAPI
        return {"msg": "Claim file share has expired."}

    # Prepare a list to store file information for generating download URLs
    file_list = []

    # Fetch each file associated with the share entry, or raise an exception if any file is not found
    claim_file_ids = crud.crud_claim_file_share_detail.get_file_ids_by_share_id(
        db_session=db_session, share_id=share_id
    )
    for claim_file_id in claim_file_ids:
        claim_file = crud_util.get_object_or_raise_exception(
            db_session, object_id=claim_file_id
        )

        # Append the file details needed to construct paths for downloading
        file_list.append(
            {
                "claim_id": claim_file.claim_id,
                "s3_key": f"claim-file/{claim_file.claim_id}/{claim_file.slugged_name}",
                "name": claim_file.name,
                "size": claim_file.size,
            }
        )

    # Use the S3 utility method to create the zip
    zip_buffer = S3.download_and_zip_files(file_list)

    # Create a streaming response to send the zip file directly
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=all_shared_files.zip"},
    )
