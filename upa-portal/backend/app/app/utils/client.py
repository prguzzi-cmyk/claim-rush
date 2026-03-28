#!/usr/bin/env python

"""Client related utility functions"""

import io
import re

from sqlalchemy.orm import Session

from app import crud, models
from app.core.config import settings
from app.core.log import logger
from app.models import ClientFile
from app.schemas import ClientCreate, ClientFileCreate, ClientFileProcess, ClientUpdate
from app.utils.exceptions import exc_forbidden, exc_internal_server
from app.utils.s3 import S3


def validate_client_ownership(
    user: models.User,
    client_obj: models.Client | ClientCreate | ClientUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user has a right to access or add/update belongs_to this client.

    Parameters
    ----------
    user : User
        The user model object.
    client_obj : models.Client | ClientCreate | ClientUpdate
        Client schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        if not crud.client.is_owner(user, client_obj):
            exc_forbidden(exception_msg)


def validate_client_ownership_or_collaboration(
    user: models.User,
    client_obj: models.Client | ClientCreate | ClientUpdate,
    exception_msg: str,
    db_session: Session | None = None,
) -> None:
    """
    Validates if the user has a right to access or add/update belongs_to this client.

    Parameters
    ----------
    user : User
        The user model object.
    client_obj : models.Client | ClientCreate | ClientUpdate
        Client schema object
    exception_msg : str
        An exception message
    db_session : Session | None
        The database session

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        if not crud.client.is_owner(user, client_obj):
            if not crud.client.check_claim_collaboration(
                db_session=db_session, user=user, client_obj=client_obj
            ):
                exc_forbidden(exception_msg)


def check_client_string_format(word: str) -> bool:
    """
    Check if the provided word matches the Client reference string format.

    Parameters
    ----------
    word : str
        The input word.

    Returns
    -------
    bool
        `True` if matched, otherwise `False`
    """
    # Define a regular expression pattern for the desired format
    pattern = re.compile(r"^UPA-CL-\d{6}$")

    # Check if the string matches the format
    if not pattern.match(word):
        return False

    return True


def process_client_file(
    file_obj: ClientFileProcess, db_session: Session
) -> None | ClientFile:
    """
    Processes the client file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    file_obj : ClientFileProcess
        File object
    db_session : Session
        Database Session

    Returns
    -------
    ClientFile
        Client file database object.
    """
    # Create a file record in the database
    object_name = (
        f"{settings.CLIENT_FILE_DIR_PATH}/{file_obj.client_id}/{file_obj.slugged_name}"
    )
    file_path = (
        f"{settings.CLIENT_FILE_URL_PATH}/{file_obj.client_id}/{file_obj.slugged_name}"
    )

    file_in = ClientFileCreate(
        client_id=file_obj.client_id,
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
    )
    client_file_obj = crud.client_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return client_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if client_file_obj:
            crud.client_file.remove(db_session, obj_id=client_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
