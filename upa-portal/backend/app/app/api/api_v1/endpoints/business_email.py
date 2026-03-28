#!/usr/bin/env python

"""Routes for the Business email module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import at_least_admin_user, get_db_session
from app.core.config import settings
from app.core.enums import FileModules
from app.core.security import decrypt_string
from app.schemas import ClaimFileProcess
from app.utils.claim import process_claim_file
from app.utils.email_retrieval import EmailRetrieval
from app.utils.emails import BusinessEmail, gen_business_email_schemas
from app.utils.exceptions import CrudUtil, exc_not_found
from app.utils.file import FileUtil

router = APIRouter()

crud_util_claim = CrudUtil(crud.claim)


@router.post(
    "/incoming-mail",
    summary="Business Email Hook",
    response_description="Success Response",
    response_model=schemas.Msg,
)
def incoming_mail(
    *,
    mail_in: schemas.BusinessEmailIncoming,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Get incoming mail data."""

    business_email = crud.business_email.get_by_email(
        db_session, email=mail_in.recipient
    )
    if not business_email:
        exc_not_found(
            "The record with this email address does not exist in the system."
        )

    email_ret = EmailRetrieval(
        settings.CPANEL_DOMAIN_NAME,
        business_email.email,
        decrypt_string(business_email.hashed_password),
    )
    messages = email_ret.fetch_unseen_emails()

    file_util = FileUtil()

    match business_email.related_type:
        case "claim_business_email":
            # Get a claim or raise an exception
            claim = crud_util_claim.get_object_or_raise_exception(
                db_session, object_id=business_email.claim_id
            )

            for message in messages:
                name_wo_ext = mail_in.subject
                ext = ".eml"
                filenames = file_util.get_formatted_filenames(
                    related_type=FileModules.CLAIM,
                    filename=name_wo_ext + ext,
                    obj_id=business_email.claim_id,
                )

                file_obj = ClaimFileProcess(
                    claim_id=claim.id,
                    name=filenames["filename"],
                    slugged_name=filenames["slugged_filename"],
                    content=bytes(message),
                    type="message/rfc822",
                    size=len(bytes(message)),
                    description=f"From: {mail_in.sender}",
                )
                process_claim_file(file_obj, db_session)

                attachments = email_ret.extract_attachments(message)

                for attachment in attachments:
                    filenames = file_util.get_formatted_filenames(
                        related_type=FileModules.CLAIM,
                        filename=attachment["filename"],
                        obj_id=business_email.claim_id,
                    )
                    file_obj = ClaimFileProcess(
                        claim_id=claim.id,
                        name=filenames["filename"],
                        slugged_name=filenames["slugged_filename"],
                        content=attachment["file"],
                        type=attachment["content_type"],
                        size=attachment["size"],
                        description=f"From: {mail_in.sender}, Sbj: {mail_in.subject}",
                    )

                    process_claim_file(file_obj, db_session)

    return {"msg": "Request Successfully processed."}


@router.post(
    "/{claim_id}/fix-issues",
    summary="Fix Business Email Issues",
    response_description="Success Response",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user),
    ],
)
def fix_issues(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Fix issues related to the business email if there is any."""
    business_email_util = BusinessEmail()

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Get email related schemas
    obj_in_email, obj_in_pipe = gen_business_email_schemas(obj_in=claim)

    # Get a business email or store business email in database
    business_email = crud.business_email.get_by_email(
        db_session, email=obj_in_email.email
    )
    if business_email:
        obj_in_email.password = decrypt_string(business_email.hashed_password)
    else:
        business_email = business_email_util.store_business_email_in_db(obj_in_email)

    email_ret = EmailRetrieval(
        settings.CPANEL_DOMAIN_NAME,
        business_email.email,
        decrypt_string(business_email.hashed_password),
    )

    # Check if email exists on the email server, if not then create it
    is_connected = email_ret.select_mailbox()
    if not is_connected:
        try:
            business_email_util.create_business_email_on_server(obj_in_email)
            business_email_util.create_business_email_pipe_on_server(obj_in_pipe)
        except Exception as e:
            if "already exists!" in str(e):
                business_email_util.update_business_email_password_on_server(
                    obj_in_email
                )

    return {"msg": "Processed the request successfully."}
