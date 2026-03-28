#!/usr/bin/env python

"""Template Files related utility functions"""

import io

from sqlalchemy.orm import Session

from app import crud, models
from app.core.config import settings
from app.core.log import logger
from app.models import TemplateFile
from app.schemas import (
    TemplateFileCreate,
    TemplateFileProcess,
    TemplateFileProcessOptional,
    TemplateFileUpdate,
)
from app.utils.exceptions import exc_forbidden, exc_internal_server
from app.utils.s3 import S3


def validate_template_file_access(
    db_session: Session,
    user: models.User,
    template_file_obj: models.TemplateFile | TemplateFileCreate | TemplateFileUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user has a right to access this template.

    Parameters
    ----------
    db_session : Session
        Database session
    user : User
        The user model object.
    template_file_obj : TemplateCreate | TemplateUpdate
        Template schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        # Check if the template has been created by the user
        if crud.template_file.is_owner(user, template_file_obj):
            return

        # Check if this template owner has admin privileges
        if hasattr(template_file_obj, "created_by_id"):
            file_owner: models.User = crud.user.get(
                db_session, obj_id=template_file_obj.created_by_id
            )
            if crud.user.has_admin_privileges(file_owner):
                return

        exc_forbidden(exception_msg)


def validate_template_file_owner(
    user: models.User,
    template_file_obj: models.TemplateFile | TemplateFileCreate | TemplateFileUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user is an owner this template.

    Parameters
    ----------
    user : User
        The user model object.
    template_file_obj : TemplateCreate | TemplateUpdate
        Template schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        # Check if the template has been created by the user
        if crud.template_file.is_owner(user, template_file_obj):
            return

        exc_forbidden(exception_msg)


def create_template_file(
    db_session: Session,
    user: models.User,
    file_obj: TemplateFileProcess,
) -> None | TemplateFile:
    """
    Processes the template file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    db_session : Session
        Database Session
    user : User
        The user model object.
    file_obj : TemplateFileProcess
        File object


    Returns
    -------
    TemplateFile
        Template file database object.
    """
    # Create a file record in the database
    object_name = f"{settings.TEMPLATE_FILE_DIR_PATH}/{user.id}/{file_obj.slugged_name}"
    file_path = f"{settings.TEMPLATE_FILE_URL_PATH}/{user.id}/{file_obj.slugged_name}"

    file_in = TemplateFileCreate(
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
        state=file_obj.state,
    )
    template_file_obj = crud.template_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return template_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if template_file_obj:
            crud.template_file.remove(db_session, obj_id=template_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")


def update_template_file(
    db_session: Session,
    user: models.User,
    template_file_obj: TemplateFile,
    file_obj: TemplateFileProcessOptional,
) -> None | TemplateFile:
    """
    Processes the template file, updates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    db_session : Session
        Database Session
    user : User
        The user model object.
    template_file_obj : TemplateFile
        The template file object
    file_obj : TemplateFileProcessOptional
        File object


    Returns
    -------
    TemplateFile
        Template file database object.
    """
    # Update a file record in the database
    object_name = (
        f"{settings.TEMPLATE_FILE_DIR_PATH}/{user.id}/{file_obj.slugged_name}"
        if file_obj.slugged_name
        else None
    )
    file_path = (
        f"{settings.TEMPLATE_FILE_URL_PATH}/{user.id}/{file_obj.slugged_name}"
        if file_obj.slugged_name
        else None
    )

    file_in = TemplateFileUpdate(
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
        state=file_obj.state,
    )
    template_file_obj = crud.template_file.update(
        db_session, db_obj=template_file_obj, obj_in=file_in.dict(exclude_none=True)
    )

    if not file_obj.content:
        return template_file_obj

    # Upload a file to S3 bucket
    try:
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return template_file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if template_file_obj:
            crud.template_file.remove(db_session, obj_id=template_file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")
