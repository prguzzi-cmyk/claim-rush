#!/usr/bin/env python

"""Celery tasks related to the Business Email Module"""

from app.core.celery_app import celery_log
from app.models import Claim
from app.utils.emails import (
    BusinessEmail,
    gen_business_email_schemas,
    send_business_email_error_email,
)


def create_business_email(
    obj_in: Claim,
) -> str:
    """
    A task to create business email on the email server.

    Parameters
    ----------
    obj_in : Claim
        A model object of the Claim

    Returns
    -------
    str
        A confirmation message.
    """
    business_email = BusinessEmail()
    celery_log.info("Business email class initialized.")

    obj_in_email, obj_in_pipe = gen_business_email_schemas(obj_in)

    celery_log.info(f"Creating email account for `{obj_in_email.username}`")

    business_email.store_business_email_in_db(obj_in_email)

    business_email.create_business_email_on_server(obj_in_email)

    business_email.create_business_email_pipe_on_server(obj_in_pipe)

    return f"Business email account `{obj_in_email.email}` created successfully."


def send_business_email_error(obj_in: Claim, error_msg: str) -> None:
    """
    Send an error email in case business email creation failed.

    Parameters
    ----------
    obj_in : Claim
        A model object of Claim
    error_msg : str
        Actual error message during email creation.
    """
    business_email = BusinessEmail()

    username = business_email.generate_email_username_via_ref(obj_in.ref_number)
    email = business_email.generate_email_address(username)

    send_business_email_error_email(email=email, error_msg=error_msg)
