#!/usr/bin/env python

"""Celery tasks related to the Lead Module"""

from app.core.log import logger
from app.models import User
from app.utils.emails import (
    send_new_lead_account_email,
)


def task_new_lead_account_email(user_entity: User, password: str) -> None:
    """
    Sends a new account email to the lead user with their account details.

    Parameters
    ----------
    user_entity : User
        The user entity containing the lead's information.
    password : str
        The password assigned to the lead's new account.
    """
    # Log the action (optional, if logging is set up)
    logger.info(f"Sending lead user account email to user: {user_entity.email}")

    # Send the email
    send_new_lead_account_email(user_entity, password)
