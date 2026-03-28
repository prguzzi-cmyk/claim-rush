#!/usr/bin/env python

"""Claim Payments related utility functions"""

import io

from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.log import logger
from app.models import ClaimPaymentFile
from app.schemas import (
    ClaimPaymentFileProcess,
    ClaimPaymentFileCreate,
)
from app.utils.exceptions import exc_internal_server
from app.utils.s3 import S3


def process_claim_payment_file(
    file_obj: ClaimPaymentFileProcess, db_session: Session
) -> None | ClaimPaymentFile:
    """
    Processes the claim payment file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    file_obj : ClaimPaymentFileProcess
        File object
    db_session : Session
        Database Session

    Returns
    -------
    ClaimPaymentFile
        Claim Payment file database object.
    """
    # Create a file record in the database
    object_name = f"{settings.CLAIM_PAYMENT_FILE_DIR_PATH}/{file_obj.payment_id}/{file_obj.slugged_name}"
    file_path = f"{settings.CLAIM_PAYMENT_FILE_URL_PATH}/{file_obj.payment_id}/{file_obj.slugged_name}"

    file_in = ClaimPaymentFileCreate(
        payment_id=file_obj.payment_id,
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
    )
    claim_payment_file_obj = crud.claim_payment_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return claim_payment_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if claim_payment_file_obj:
            crud.claim_payment_file.remove(db_session, obj_id=claim_payment_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
