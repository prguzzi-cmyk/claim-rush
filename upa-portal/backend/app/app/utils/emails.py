#!/usr/bin/env python

"""Email related utility functions for the application"""

import re
import smtplib
import ssl
import uuid as _uuid
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, List, Tuple
from urllib.parse import quote

import fastapi
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.security import generate_random_password
from app.db.session import SessionLocal
from app.models import BusinessEmail as BusinessEmailModel
from app.models import Claim, ClaimBusinessEmail, User
from app.schemas import (
    BusinessEmailCreate,
    BusinessEmailPipeCreate,
    ClaimBusinessEmailCreate,
)
from app.utils.common import generate_ref_string, read_file
from app.utils.cpanel import Cpanel
from app.utils.jinja import render_template, render_text
from app.utils.s3 import S3


class BusinessEmail:
    """The base class for Business Email."""

    def __init__(self):
        self._db_session: Session = SessionLocal()

    @staticmethod
    def generate_email_address(username: str) -> EmailStr:
        """
        Generate a business email address by using username

        Parameters
        ----------
        username : EmailStr
            The username for the email address

        Returns
        -------
        EmailStr
            Generated business email address
        """
        return username + "@" + settings.CPANEL_DOMAIN_NAME

    @staticmethod
    def generate_email_username_via_ref(ref_number: str) -> str:
        """
        Generate an email username via reference number.

        Parameters
        ----------
        ref_number : str
            The reference number

        Returns
        -------
        str
            The generated email username.
        """
        return generate_ref_string(settings.CLAIM_REF_INITIALS, ref_number).lower()

    def store_business_email_in_db(
        self, obj_in: ClaimBusinessEmailCreate | BusinessEmailCreate
    ) -> ClaimBusinessEmail | BusinessEmailModel:
        """
        Store business email related data in the database.

        Parameters
        ----------
        obj_in : ClaimBusinessEmailCreate | BusinessEmailCreate
            Schema object of the Business email

        Returns
        -------
        ClaimBusinessEmail | BusinessEmail
            The database model object of either type.
        """
        match obj_in:
            case ClaimBusinessEmailCreate():
                # Create a new record under claim business email
                return crud.claim_business_email.create(
                    db_session=self._db_session, obj_in=obj_in
                )
            case _:
                # Create a new record under business email
                return crud.business_email.create(
                    db_session=self._db_session, obj_in=obj_in
                )

    @staticmethod
    def create_business_email_on_server(obj_in: BusinessEmailCreate):
        """
        Create a new business email on the email server.

        Parameters
        ----------
        obj_in : BusinessEmailCreate
            Schema object for business email
        """
        # Create email address on the email server
        cpanel = Cpanel()
        cpanel.create_email_account(obj_in.username, obj_in.password)

    @staticmethod
    def create_business_email_pipe_on_server(obj_in: BusinessEmailPipeCreate):
        """
        Create a new business email pipe on the email server.

        Parameters
        ----------
        obj_in : BusinessEmailPipeCreate
            Schema object for business email pipe forwarder
        """
        # Create email forwarder on the email server
        cpanel = Cpanel()
        cpanel.create_email_pipe(email=obj_in.email, script_path=obj_in.script_path)

    @staticmethod
    def update_business_email_password_on_server(obj_in: BusinessEmailCreate):
        """
        Update business email password on the email server.

        Parameters
        ----------
        obj_in : BusinessEmailCreate
            Schema object for business email password update
        """
        # Update email password on the email server
        cpanel = Cpanel()
        cpanel.update_email_password(obj_in.username, obj_in.password)


def inject_tracking(body_html: str, communication_log_id: str) -> str:
    """Inject open-tracking pixel and rewrite links for click tracking."""
    server_host = str(settings.SERVER_HOST).rstrip("/")
    api_prefix = settings.API_V1_STR

    # Click tracking: rewrite <a href="..."> (skip mailto:/tel:/# links)
    def _rewrite_link(match):
        href = match.group(1)
        if href.startswith(("mailto:", "tel:", "#", "javascript:")):
            return match.group(0)
        encoded_url = quote(href, safe="")
        tracked = f"{server_host}{api_prefix}/c/{communication_log_id}?url={encoded_url}"
        return f'<a href="{tracked}"'

    body_html = re.sub(r'<a\s+href="([^"]*)"', _rewrite_link, body_html, flags=re.IGNORECASE)

    # Open tracking: inject 1x1 pixel before </body>
    pixel = (
        f'<img src="{server_host}{api_prefix}/t/{communication_log_id}.gif" '
        f'width="1" height="1" style="display:none" alt="" />'
    )
    if "</body>" in body_html.lower():
        body_html = re.sub(
            r"(</body>)", f"{pixel}\\1", body_html, count=1, flags=re.IGNORECASE,
        )
    else:
        body_html += pixel

    return body_html


def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_plain: str = "",
    attachments: List[Tuple[bytes, str]] | None = None,
    communication_log_id: str | None = None,
) -> str | None:
    """
    Email the recipient with options for plain text, HTML content, and attachments.

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
    attachments : List[Tuple[bytes, str]] | None
        A list of attachments where each attachment is represented as a tuple of (content, filename).
    communication_log_id : str | None
        If provided, inject open/click tracking into the HTML body.

    Returns
    -------
    str | None
        The SMTP Message-ID header value, or None.
    """
    assert settings.EMAILS_ENABLED, "no provided configuration for email variables"

    # Inject tracking if communication_log_id is provided
    if communication_log_id:
        body_html = inject_tracking(body_html, communication_log_id)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.EMAIL_FROM_BRAND_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = to

    # Generate a deterministic Message-ID
    domain = settings.EMAILS_FROM_EMAIL.split("@")[-1] if "@" in settings.EMAILS_FROM_EMAIL else "upaportal.org"
    msg_id = f"<{_uuid.uuid4()}@{domain}>"
    message["Message-ID"] = msg_id

    # Turn these into plain/html MIMEText objects
    obj_plain = MIMEText(body_plain, "plain")
    obj_html = MIMEText(body_html, "html")

    # Add HTML/plain-text parts to MIMEMultipart message
    # The email client will try to render the last part first
    message.attach(obj_plain)
    message.attach(obj_html)

    # Attach files if provided
    if attachments:
        for file_content, filename in attachments:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(file_content)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            message.attach(part)

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

    return msg_id


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
        "project_url": settings.PROJECT_URL,
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
        The model object of User

    Returns
    -------
    None
        Returns None
    """
    project_name = settings.PROJECT_NAME
    subject = f"Welcome to {project_name}!"
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


def send_new_lead_account_email(user: User, password: str) -> None:
    """
    Sends an email to a newly created lead user with account details including
    their username and a system-generated password.

    Parameters
    ----------
    user : User
        The user object representing the new lead user.
    password : str
        The system-generated password for the user's account.

    Raises
    ------
    EmailSendError
        If there is an issue with sending the email.
    """
    subject = "Welcome to Your Account – Access Your Lead Information!"
    full_name = f"{user.first_name} {user.last_name}"
    username = user.email
    context = {
        **get_project_context(email_tagline="New Account"),
        "full_name": full_name,
        "username": username,
        "password": password,
    }
    body_html = render_template(
        template="new_lead_account.html",
        context=context,
    )
    body_plain = render_text(read_file("new_lead_account.txt"), context=context)

    send_email(
        to=user.email, subject=subject, body_html=body_html, body_plain=body_plain
    )


def send_business_email_error_email(email: str, error_msg: str) -> None:
    """
    Send a business email creation error email

    Parameters
    ----------
    email : str
        The business email address
    error_msg : str
        The error message while creating an email

    Returns
    -------
    None
        Returns None
    """
    project_name = settings.PROJECT_NAME
    subject = f"Business Email creation error - {project_name}"
    context = {
        **get_project_context(email_tagline="Business Email"),
        "email": email,
        "error_msg": error_msg,
    }
    body_html = render_template(
        template="business_email_error.html",
        context=context,
    )
    body_plain = render_text(read_file("business_email_error.txt"), context=context)

    send_email(
        to=settings.ADMIN_EMAIL,
        subject=subject,
        body_html=body_html,
        body_plain=body_plain,
    )


def gen_business_email_schemas(obj_in: Claim) -> tuple:
    """
    Generate schemas for business email.

    Parameters
    ----------
    obj_in : Claim
        Database model object of Claim

    Returns
    -------
    tuple
        Returns Claim Business Email Create and Business Email Pipe Create schemas.
    """
    business_email = BusinessEmail()

    password = generate_random_password()
    username = business_email.generate_email_username_via_ref(obj_in.ref_number)
    email = business_email.generate_email_address(username)

    obj_in_email = ClaimBusinessEmailCreate(
        claim_id=obj_in.id,
        username=username,
        email=email,
        password=password,
    )
    obj_in_pipe = BusinessEmailPipeCreate(
        email=email, script_path=settings.CPANEL_EMAIL_PIPE_PATH
    )

    return obj_in_email, obj_in_pipe


def send_claim_file_share_email(
    sender: str,
    sender_company: str,
    client_name: str,
    claim_ref_num: str,
    to: str,
    link: str | None,
    message: str,
    sender_email: str,
    request: fastapi.Request,
    attachments: List[str] | None = None,
) -> None:
    """
    Send an email notification about claim files being shared, with an optional link to the shared files,
    an optional message, and optional file attachments.

    Parameters
    ----------
    sender : str
        The email address of the user who initiated the share.
    sender_company : str
        The name of the company associated with the sender.
    sender_email : str
        The email of the sender.
    client_name : str
        The full name of the client.
    claim_ref_num : str
        The reference number of the claim.
    to : str
        The recipient's email address.
    link : str | None
        The URL link to the shared claim files, if applicable.
    message : str
        An optional message included with the share.
    request : fastapi.Request
        The request object, used for accessing request-specific information.
    attachments : List[str] | None
        A list of file paths or identifiers for files to attach, if applicable.

    Returns
    -------
    None
        Returns None.
    """
    assert settings.EMAILS_ENABLED, "Email functionality is not configured."

    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Claim File Share Notification"
    template = (
        "claim_file_share_with_attachment.html"
        if attachments
        else "claim_file_share.html"
    )
    context = {
        **get_project_context(email_tagline="Claim File Share"),
        "link": f"{settings.SERVER_HOST}/#/fv/{link}" if link else None,
        "message": message,
        "sender": sender,
        "sender_company": sender_company,
        "sender_email": sender_email,
        "client_name": client_name,
        "claim_ref_num": claim_ref_num,
        "request": request,
    }
    body_html = render_template(template=template, context=context)
    body_plain = render_text(read_file(f"{template[:-5]}.txt"), context=context)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.SMTP_USER
    message["To"] = to

    # Attach the plain and HTML parts
    message.attach(MIMEText(body_plain, "plain"))
    message.attach(MIMEText(body_html, "html"))

    # Download files from S3 if attachments are provided
    attachment_contents = []
    if attachments:
        attachment_files = S3.download_files_from_s3(attachments)
        attachment_contents = [
            (content, filename) for content, filename in attachment_files
        ]

    # Create secure connection with server and send email
    send_email(
        to=to,
        subject=subject,
        body_html=body_html,
        body_plain=body_plain,
        attachments=attachment_contents,  # pass the list of tuples for attachments
    )


def is_valid_attachment_size(total_size):
    # Check if the total size exceeds 25 MB (25,000,000 bytes)
    if total_size > 25 * 1024 * 1024:  # Convert MB to bytes
        return False
    else:
        return True
