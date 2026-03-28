#!/usr/bin/env python

"""Claim Permission Dependencies"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db_session,
    AbstractPermissionChecker,
    BasePermissions,
)
from app.core.log import logger
from app.crud import claim
from app.db.data.claim_user_permissions import CLAIM_PERMISSIONS
from app.models import User, ClaimComment, ClaimFile, ClaimTask
from app.utils.exceptions import exc_forbidden, exc_not_found


class ClaimPermissionChecker(AbstractPermissionChecker):
    """Permission checker class for dependency to confirm the collaborator user has
    the required permission/s to perform a task."""

    def __init__(
        self,
        required_permissions: list[str],
        db_session: Annotated[Session, Depends(get_db_session)],
        claim_id: UUID,
    ) -> None:
        """
        Initialize Claim Permission Checker class with required permissions.

        Parameters
        ----------
        required_permissions : list
            A list of required permissions to perform a task.
        db_session : Session
            Database session
        claim_id : UUID
            Claim ID
        """
        super().__init__(required_permissions)

        self._db_session = db_session
        self._claim_id = claim_id
        self._permissions = CLAIM_PERMISSIONS

    def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> None:
        """
        Checks if the user has the required permissions for the specific claim.

        Parameters
        ----------
        user : User
            A User model object
        """
        from app.utils.claim import get_claim_specific_role

        claim_obj = claim.get(
            db_session=self._db_session, obj_id=self._claim_id, even_removed=True
        )
        if not claim_obj:
            exc_not_found(msg="Claim not found")

        claim_role = get_claim_specific_role(user=user, claim_obj=claim_obj)
        if not claim_role:
            logger.debug(f"{user.email} has no claim role")
            exc_forbidden(msg="Operation not permitted")

        for permission in self._required_permissions:
            if permission not in self._permissions.get(claim_role, []):
                logger.debug(
                    f"{user.email} has no claim-specific permission '{permission}'"
                )
                exc_forbidden(msg="Operation not permitted")

    @staticmethod
    def validate_ownership(
        user: User,
        resource: ClaimComment | ClaimFile | ClaimTask,
        exception_msg: str,
    ) -> None:
        """
        Validates if the user has created this claim resource.

        Parameters
        ----------
        user : User
            The user model object.
        resource : ClaimComment | ClaimFile | ClaimTask
            Claim resource model object.
        exception_msg : str
            An exception message

        Raises
        ------
        HTTPException:
           If the user is not an owner of the resource.
        """
        if resource.created_by_id != user.id:
            exc_forbidden(exception_msg)


class ClaimPermissions(BasePermissions[ClaimPermissionChecker]):
    def __init__(
        self,
        module: str,
        db_session: Annotated[Session, Depends(get_db_session)],
        claim_id: UUID,
    ) -> None:
        super().__init__(module)
        self._db_session = db_session
        self._claim_id = claim_id

    def get_permission_dependency(self, operation: str) -> ClaimPermissionChecker:
        return ClaimPermissionChecker(
            [f"{self.module}:{operation}"],
            db_session=self._db_session,
            claim_id=self._claim_id,
        )
