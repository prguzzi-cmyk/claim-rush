#!/usr/bin/env python

"""Email related utility functions for the application"""

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.core.config import settings
from app.models import User
from app.utils.common import read_file
from app.utils.jinja import render_template, render_text


def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_plain: str = "",
) -> None:
    """
    Send email to the recipient either plain text or HTML

    Parameters
    ----------
    to : str
        To address
    subject : str
        Subject of an email
    body_html : str
        HTML body for the email
    body_plain : str
        Plain text for the email

    Returns
    -------
    None
        Returns None
    """
    assert settings.EMAILS_ENABLED, "no provided configuration for email variables"

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.EMAILS_FROM_EMAIL
    message["To"] = to

    # Turn these into plain/html MIMEText objects
    obj_plain = MIMEText(body_plain, "plain")
    obj_html = MIMEText(body_html, "html")

    # Add HTML/plain-text parts to MIMEMultipart message
    # The email client will try to render the last part first
    message.attach(obj_plain)
    message.attach(obj_html)

    # Create secure connection with server and send email
    if settings.SMTP_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to, message.as_string())
    else:
        context = ssl.create_default_context()

        with smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, context=context
        ) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to, message.as_string())


def get_project_context(email_tagline: str = "") -> dict[str, Any]:
    """
    Generate a dictionary of global project constants required for an email

    Parameters
    ----------
    email_tagline : str
        Text for the email tagline

    Returns
    -------
    dict
        Returns dictionary of Project related constants
    """
    return {
        "project_name": settings.PROJECT_NAME,
        "project_contact_address": settings.CONTACT_ADDRESS,
        "project_contact_phone": settings.CONTACT_PHONE,
        "project_contact_email": settings.CONTACT_EMAIL,
        "admin_name": settings.ADMIN_NAME,
        "email_tagline": email_tagline,
    }


def send_test_email(to: str) -> None:
    """
    Send test email

    Parameters
    ----------
    to : str
        To address

    Returns
    -------
    None
        Returns None
    """
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    context = {
        **get_project_context(email_tagline="Test Email"),
        "email": to,
    }
    body_html = render_template(template="test_email.html", context=context)
    body_plain = render_text(read_file("test_email.txt"), context=context)

    send_email(to=to, subject=subject, body_html=body_html, body_plain=body_plain)


def send_reset_password_email(to: str, email: str, token: str) -> None:
    """
    Send password reset email

    Parameters
    ----------
    to : str
        To address
    email : str
        Email address to which the request generated
    token : str
        Access token to reset password

    Returns
    -------
    None
        Returns None
    """
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password recovery for user {email}"
    server_host = settings.SERVER_HOST
    link = f"{server_host}/forgot-password?token={token}"
    context = {
        **get_project_context(email_tagline="Password Recovery"),
        "username": email,
        "email": to,
        "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
        "link": link,
    }
    body_html = render_template(
        template="reset_password.html",
        context=context,
    )
    body_plain = render_text(read_file("reset_password.txt"), context=context)

    send_email(to=to, subject=subject, body_html=body_html, body_plain=body_plain)


def send_new_account_email(user: User) -> None:
    """
    Send new account creation email

    Parameters
    ----------
    user : User
        User model object

    Returns
    -------
    None
        Returns None
    """
    project_name = settings.PROJECT_NAME
    subject = f"Welcome to {project_name}"
    full_name = f"{user.first_name} {user.last_name}"
    context = {
        **get_project_context(email_tagline="New Account"),
        "full_name": full_name,
    }
    body_html = render_template(
        template="new_account.html",
        context=context,
    )
    body_plain = render_text(read_file("new_account.txt"), context=context)

    send_email(
        to=user.email, subject=subject, body_html=body_html, body_plain=body_plain
    )
