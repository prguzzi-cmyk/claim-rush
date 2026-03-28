#!/usr/bin/env python

"""User Tasks related utility functions"""

from app import crud, models
from app.schemas import UserTaskCreate, UserTaskUpdate
from app.utils.exceptions import exc_forbidden


def validate_assignee(
    user: models.User,
    task_obj: models.UserTask | UserTaskCreate | UserTaskUpdate,
    exception_msg: str,
) -> None:
    """
    Validates if the user has a right to access or add/update assignee of this task.

    Parameters
    ----------
    user : User
        The user model object.
    task_obj : models.UserTask | UserTaskCreate | UserTaskUpdate
        User Task model or schema object
    exception_msg : str
        An exception message

    Raises
    ------
    HTTPException:
       If the user is not privileged.
    """
    if not crud.user.has_admin_privileges(user):
        if user.id != task_obj.assignee_id:
            exc_forbidden(exception_msg)
