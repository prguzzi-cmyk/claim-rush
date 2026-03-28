#!/usr/bin/env python

"""Leads related utility functions"""

import io
import re

from sqlalchemy.orm import Session

from app import crud, models
from app.core.config import settings
from app.core.enums import LeadStatus, PolicyEffect
from app.core.log import logger
from app.core.rbac import Modules, MiscOperations
from app.models import LeadFile
from app.schemas import LeadCreate, LeadFileCreate, LeadFileProcess, LeadUpdate
from app.utils.common import generate_permission
from app.utils.exceptions import exc_forbidden, exc_internal_server, exc_unprocessable
from app.utils.s3 import S3


def validate_lead_ownership(
    user: models.User,
    lead_obj: models.Lead | LeadCreate | LeadUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user has a right to access or add/update assigned_to this lead.

    Parameters
    ----------
    user : User
        The user model object.
    lead_obj : LeadCreate or LeadUpdate
        Lead schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        if not crud.lead.is_owner(user, lead_obj):
            lead_assign_permission = generate_permission(
                Modules.LEAD.value, MiscOperations.ASSIGN_LEAD.value
            )
            user_permissions = crud.permission.get_user_permissions(user)
            is_allowed = next(
                (
                    user_perm
                    for user_perm in user_permissions
                    if user_perm.name == lead_assign_permission
                    and user_perm.effect != PolicyEffect.DENY.value
                ),
                False,
            )
            if not is_allowed:
                exc_forbidden(exception_msg)


def validate_incoming_lead_status(
    user: models.User,
    obj_in: models.Lead | LeadCreate | LeadUpdate,
) -> None:
    """
    Validates if the user has a right to set a particular status for this lead.

    Parameters
    ----------
    user : User
        The user model object.
    obj_in : Lead | LeadCreate | LeadUpdate
        Lead schema object

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if isinstance(obj_in, LeadUpdate):
        if hasattr(obj_in, "status") and obj_in.status == LeadStatus.SIGNED_APPROVED:
            if not crud.user.has_admin_privileges(user):
                exc_unprocessable(
                    f"You can't set the status to `{LeadStatus.SIGNED_APPROVED.value}`"
                    f" for a lead."
                )


def check_lead_string_format(word: str) -> bool:
    """
    Check if the provided word matches the Lead reference string format.

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
    pattern = re.compile(r"^UPA-LD-\d{6}$")

    # Check if the string matches the format
    if not pattern.match(word):
        return False

    return True


def process_lead_file(
    file_obj: LeadFileProcess, db_session: Session
) -> None | LeadFile:
    """
    Processes the lead file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    file_obj : LeadFileProcess
        File object
    db_session : Session
        Database Session

    Returns
    -------
    LeadFile
        Lead file database object.
    """
    # Create a file record in the database
    object_name = (
        f"{settings.LEAD_FILE_DIR_PATH}/{file_obj.lead_id}/{file_obj.slugged_name}"
    )
    file_path = (
        f"{settings.LEAD_FILE_URL_PATH}/{file_obj.lead_id}/{file_obj.slugged_name}"
    )

    file_in = LeadFileCreate(
        lead_id=file_obj.lead_id,
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
    )
    lead_file_obj = crud.lead_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return lead_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if lead_file_obj:
            crud.lead_file.remove(db_session, obj_id=lead_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
