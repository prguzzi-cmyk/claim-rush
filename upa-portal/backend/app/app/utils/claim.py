#!/usr/bin/env python

"""Claims related utility functions"""

import io
import re

from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps.claim_permission import ClaimPermissions, ClaimPermissionChecker
from app.core.config import settings
from app.core.enums import ClaimRoles
from app.core.log import logger
from app.core.rbac import Modules, Operations
from app.models import ClaimFile, User, ClaimComment, ClaimTask
from app.schemas import (
    ClaimCreate,
    ClaimFileCreate,
    ClaimFileProcess,
    ClaimUpdate,
    Claim,
    ClaimCollaborator,
)
from app.utils.exceptions import exc_forbidden, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3


def validate_claim_ownership(
    db_session: Session,
    user: models.User,
    claim_obj: models.Claim | ClaimCreate | ClaimUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user has a right to access or add/update assigned_to this claim.

    Parameters
    ----------
    db_session : Session
        Database session
    user : User
        The user model object.
    claim_obj : ClaimCreate | ClaimUpdate
        Claim schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        # Check if the claim has been assigned to the user
        if crud.claim.is_owner(user, claim_obj):
            return

        # Check if the user is a collaborator
        if crud.claim.is_collaborator(user, claim_obj):
            return

        # Check if the user is the source (allows sales rep access)
        if crud.claim.is_source(user, claim_obj):
            return

        # Check if this claim client ID belongs to the user
        if hasattr(claim_obj, "client_id"):
            client = crud.client.get(db_session, obj_id=claim_obj.client_id)
            if crud.client.is_owner(user, client):
                return

        exc_forbidden(exception_msg)


def validate_claim_role(
    module: Modules,
    db_session: Session,
    claim: models.Claim | ClaimCreate | ClaimUpdate,
    user: models.User,
    *,
    operation: Operations | None = None,
    resource: ClaimComment | ClaimFile | ClaimTask | None = None,
    resource_exc_msg: str | None = None,
) -> None:
    """
    Validate the collaborator role against required permissions.

    Parameters
    ----------
    db_session : Session
        Database session
    claim : models.Claim | ClaimCreate | ClaimUpdate
        Claim database object or schemas
    user : models.User
        The User database model object
    module : Modules
        Module name
    operation : Operations | None
        Operation name
    resource : ClaimComment | ClaimFile | ClaimTask | None
        The claim resource model object
    resource_exc_msg : str | None
        The exception message when the user is not an owner of the resource
    """
    if crud.claim.is_collaborator(user=user, claim_obj=claim):
        claim_permissions = ClaimPermissions(
            module=module.value, db_session=db_session, claim_id=claim.id
        )

        match operation:
            case Operations.CREATE:
                permissions_checker: ClaimPermissionChecker = claim_permissions.create()
            case Operations.UPDATE:
                permissions_checker: ClaimPermissionChecker = claim_permissions.update()
            case Operations.REMOVE:
                permissions_checker: ClaimPermissionChecker = claim_permissions.remove()
            case Operations.RESTORE:
                permissions_checker: ClaimPermissionChecker = (
                    claim_permissions.restore()
                )
            case _:
                permissions_checker: ClaimPermissionChecker = claim_permissions.read()

        permissions_checker(user=user)

        if resource:
            permissions_checker.validate_ownership(
                user=user,
                resource=resource,
                exception_msg=(
                    resource_exc_msg
                    if resource_exc_msg
                    else "You don't have permissions to modify this claim resource."
                ),
            )


def check_claim_string_format(word: str) -> bool:
    """
    Check if the provided word matches the Claim reference string format.

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
    pattern = re.compile(r"^UPA-CM-\d{6}$")

    # Check if the string matches the format
    if not pattern.match(word):
        return False

    return True


def process_claim_file(
    file_obj: ClaimFileProcess, db_session: Session
) -> None | ClaimFile:
    """
    Processes the claim file, creates a db record and upload file to the S3 bucket.

    Parameters
    ----------
    file_obj : ClaimFileProcess
        File object
    db_session : Session
        Database Session

    Returns
    -------
    ClaimFile
        Claim file database object.
    """
    # Create a file record in the database
    object_name = (
        f"{settings.CLAIM_FILE_DIR_PATH}/{file_obj.claim_id}/{file_obj.slugged_name}"
    )
    file_path = (
        f"{settings.CLAIM_FILE_URL_PATH}/{file_obj.claim_id}/{file_obj.slugged_name}"
    )

    file_in = ClaimFileCreate(
        claim_id=file_obj.claim_id,
        name=file_obj.name,
        slugged_name=file_obj.slugged_name,
        type=file_obj.type,
        size=file_obj.size,
        path=file_path,
        description=file_obj.description,
        can_be_removed=file_obj.can_be_removed,
        visibility=file_obj.visibility or "internal",
    )
    claim_file_obj = crud.claim_file.create(db_session, obj_in=file_in)

    # Upload a file to S3 bucket
    try:
        logger.info(
            "Uploading claim file to S3: bucket=%s, key=%s, type=%s, size=%s",
            settings.S3_BUCKET_NAME,
            object_name,
            file_obj.type,
            file_obj.size,
        )
        S3.upload_file_obj(
            file=io.BytesIO(file_obj.content),
            object_name=object_name,
            content_type=file_obj.type,
        )

        return claim_file_obj
    except Exception as e:
        # Log full exception details
        logger.error(
            "S3 upload failed for claim file '%s' (key=%s): %s",
            file_obj.name,
            object_name,
            e,
            exc_info=True,
        )

        # Remove the file record if created
        if claim_file_obj:
            crud.claim_file.remove(db_session, obj_id=claim_file_obj.id)

        # Raise exception with specific detail
        exc_internal_server(
            f"File storage error: could not upload '{file_obj.name}' — {type(e).__name__}: {e}"
        )


def get_claim_specific_role(user: User, claim_obj: Claim) -> str:
    """
    Get user role for a claim.

    Parameters
    ----------
    user : User
        Database object model of user.
    claim_obj : Claim
        Database object model of claim.

    Returns
    -------
    str
        Role name or None
    """
    role = None

    if user.id in [collaborator.id for collaborator in claim_obj.collaborators]:
        role = ClaimRoles.COLLABORATOR.value
    if claim_obj.source == user.id:
        role = ClaimRoles.SOURCE.value
    if claim_obj.signed_by == user.id:
        role = ClaimRoles.SIGNER.value
    if claim_obj.adjusted_by == user.id:
        role = ClaimRoles.ADJUSTER.value

    # Sales rep and client users always get restricted claim role - never bypass
    if user.role and user.role.name in ("sales-rep", "client"):
        return role or ClaimRoles.SOURCE.value

    # Override Claim role in case of Admin or Claim Owner
    if (
        crud.user.has_admin_privileges(user_obj=user)
        or claim_obj.assigned_to == user.id
    ):
        role = None

    return role


def get_collaborated_claim_list(claims_list: CustomPage, user: User) -> CustomPage:
    """
    Get a Custom Page listing of claim including Claim and Claim Collaborator schema response.

    Parameters
    ----------
    claims_list : CustomPage
        Custom Page consists of claim object in a list.
    user : User
        The current user database model object.

    Returns
    -------
    CustomPage
        Updated CustomPage including Claim Collaborator schema.
    """
    claims = []

    if claims_list:
        for claim in claims_list.items:
            claim_dict: dict = claim.__dict__
            claim_dict.pop("is_collaborator", None)

            claim_role = get_claim_specific_role(user=user, claim_obj=claim)

            if claim_role is None:
                claims.append(Claim(**claim_dict))
            else:
                # Add Claim role to the response
                claim_dict["claim_role"] = claim_role
                claims.append(ClaimCollaborator(**claim_dict))

        claims_list.items = claims

    return claims_list
