#!/usr/bin/env python

"""Leads related utility functions"""

import io

from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.log import logger
from app.models import LeadFile
from app.models.user_personal_file import UserPersonalFile
from app.schemas import LeadFileCreate, LeadFileProcess, UserPersonalFileProcess, UserPersonalFileCreate
from app.utils.exceptions import exc_internal_server
from app.utils.s3 import S3


def process_user_personal_file(
    file_obj: UserPersonalFileProcess, db_session: Session
) -> None | UserPersonalFile:
    """
    Processes the lead file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    file_obj : UserPersonalFileProcess
        File object
    db_session : Session
        Database Session

    Returns
    -------
    UserPersonalFile
        Lead file database object.
    """
    # Create a file record in the database
    object_name = (
        f"{settings.USER_PERSONAL_FILE_DIR_PATH}/{file_obj.owner_id}/{file_obj.slugged_name}"
    )
    file_path = (
        f"{settings.USER_PERSONAL_FILE_URL_PATH}/{file_obj.owner_id}/{file_obj.slugged_name}"
    )

    file_in = UserPersonalFileCreate(
        owner_id=file_obj.owner_id,
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        state = file_obj.state,
        expiration_date = file_obj.expiration_date,
        can_be_removed=file_obj.can_be_removed,
    )
    personal_file_obj = crud.user_personal_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return personal_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if personal_file_obj:
            crud.user_personal_file.remove(db_session, obj_id=personal_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
