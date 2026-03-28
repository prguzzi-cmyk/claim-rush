#!/usr/bin/env python

"""Common utility functions for the application"""

import os
import pathlib
import re
from datetime import date, datetime, timedelta
from functools import reduce
from pathlib import Path
from typing import Any, Set
from urllib.parse import urlparse

from fastapi.encoders import jsonable_encoder
from jose import jwt
from sqlalchemy import inspect
from sqlalchemy.orm.exc import DetachedInstanceError

from app.core.config import settings
from app.core.enums import RefTypes
from app.utils.constants import constants


def generate_permission(module: str, operation: str) -> str:
    """
    Generates permission name with the help of module and operation name.

    Parameters
    ----------
    module : str
        Name of the module
    operation : str
        Name of the operation

    Returns
    -------
    str
        Formatted permission name.
    """
    return f"{module.lower()}:{operation.lower()}"


def degenerate_permission(permission: str) -> dict[str, str]:
    """
    Degenerates permission name.

    Parameters
    ----------
    permission : str
        Name of the permission

    Returns
    -------
    dict
        Degenerated permission dictionary.
    """
    result = permission.split(":")
    return dict(module=result[0], operation=result[1])


def slugify(string: str) -> str:
    """
    Converts a string to a URL-friendly slug.

    Parameters
    ----------
    string : str
        String to convert

    Returns
    -------
    str
        Returns URL-friendly slug.
    """
    result = string.lower().strip()
    result = re.sub(r"[^\w\s-]", "", result)
    result = re.sub(r"[\s_-]+", "-", result)
    result = re.sub(r"^-+|-+$", "", result)

    return result


def is_slug(string: str) -> bool:
    """
    Check if a string is a slug.

    Parameters
    ----------
    string : str
        String to check

    Returns
    -------
    bool
        `True` if string is a slug, else `False`.
    """
    return bool(re.match(r"^[a-z0-9_-]+$", string))


def slug_to_capital_case(string: str) -> str:
    """
    Converts a slug to a user-friendly string.

    Parameters
    ----------
    string : str
        String to convert

    Returns
    -------
    str
        Returns user-friendly string.
    """
    words = string.split("-")
    result = " ".join(word.capitalize() for word in words)

    return result


def camel_to_snake_case(string: str) -> str:
    """
    Convert camel case to snake case.

    Parameters
    ----------
    string : str
        Camel case string

    Returns
    -------
    str
        Converted snake case string.
    """
    return reduce(lambda x, y: x + ("_" if y.isupper() else "") + y, string).lower()


def generate_password_reset_token(email: str) -> str:
    """
    Generate reset token for the password reset.

    Parameters
    ----------
    email : str
        Subject for the reset token

    Returns
    -------
    str
        Return generated token for password reset.
    """
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.utcnow()
    expires = now + delta
    exp = expires.timestamp()
    encode_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email}, settings.SECRET_KEY, algorithm="HS256"
    )

    return encode_jwt


def verify_password_reset_token(token: str) -> str | None:
    """
    Verify the provided token

    Parameters
    ----------
    token : str
        Password reset token

    Returns
    -------
    str
        Return email address from the decoded token otherwise None
    """
    try:
        decoded_token = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return decoded_token["sub"]
    except jwt.JWTError:
        return None


def read_file(filename: str) -> str:
    """
    Read content of a file

    Parameters
    ----------
    filename : str
        Name of the file

    Returns
    -------
    str
        Returns content of the file
    """
    with open(Path(settings.EMAIL_TEMPLATES_DIR) / filename) as f:
        content = f.read()

    return content


def get_file_extension(filename: str) -> str:
    """
    Get an extension of a file.

    Parameters
    ----------
    filename : str
        File name

    Returns
    -------
    str
        File extension
    """
    return pathlib.Path(filename).suffix


def remove_file_extension(filename: str) -> str:
    """
    Remove an extension of a file.

    Parameters
    ----------
    filename : str
        File name

    Returns
    -------
    str
        Filename without extension
    """
    name, _ = os.path.splitext(filename)

    return name


def extract_number_from_string(string: str) -> int:
    """
    Extract numbers from a string.

    Parameters
    ----------
    string : str
        String value to fetch numbers.

    Returns
    -------
    int
        Number from a string.

    Raises
    ------
    HTTPException
        If the provided string don't have any number.
    """
    result = "".join(re.findall(r"\d+", string))
    if not result:
        from app.utils.exceptions import exc_unprocessable

        exc_unprocessable(f"`{string}` doesn't contain any number.")

    return int(result)


def extract_emails_from_string(string: str, raise_exception: bool = False) -> list[str]:
    """
    Extract emails from a string.

    Parameters
    ----------
    string : str
        String value to fetch emails.
    raise_exception : bool
        Raises an exception if `True`

    Returns
    -------
    list[str]
        A list of emails.

    Raises
    ------
    HTTPException
        If the provided string don't have any email.
    """
    result = re.findall(constants.EMAIL_REGEX, string)
    if result is None and raise_exception:
        from app.utils.exceptions import exc_unprocessable

        exc_unprocessable(f"`{string}` doesn't contain any email.")

    return result


def extract_filename_from_url(url: str) -> str | None:
    """
    Extract a filename from a URL.

    Parameters
    ----------
    url : str
        URL path string.

    Returns
    -------
    str | None
        A filename if found, otherwise None.
    """
    parsed_url = urlparse(url)
    path_components = parsed_url.path.split("/")
    path_last_component = path_components[-1]

    # Check if last component has an extension
    if path_last_component and os.path.splitext(path_last_component)[1]:
        return path_last_component
    else:
        # If last component doesn't have an extension, return None
        return None


def generate_ref_string(ref_type: RefTypes, value: str) -> str:
    """
    Create a reference string for a record.

    Parameters
    ----------
    ref_type : RefTypes
        The type of module.
    value : str
        The reference number that will be added in the final string.

    Returns
    -------
    str
        A combination of prefix for a module and reference number.
    """
    formatted_value = str(value).zfill(6)

    match ref_type:
        case RefTypes.LEAD:
            ref_str = f"{settings.LEAD_REF_INITIALS}{formatted_value}"
        case RefTypes.CLIENT:
            ref_str = f"{settings.CLIENT_REF_INITIALS}{formatted_value}"
        case _:
            ref_str = f"{settings.CLAIM_REF_INITIALS}{formatted_value}"

    return ref_str


def remove_domain_from_path(file_path: str) -> str:
    """
    Remove a domain name including protocol from a file path.

    Parameters
    ----------
    file_path : str
        Path to the file

    Returns
    -------
    str
        File path without protocol and domain.
    """
    parsed_url = urlparse(file_path)
    if parsed_url.scheme and parsed_url.netloc:
        return parsed_url.path
    else:
        return file_path


def default_expiration_date() -> date:
    """
    Calculate the default expiration date, which is 30 days from today.

    This function computes the date 30 days from today's date and returns it
    as a string formatted as 'YYYY-MM-DD'.

    Returns:
        str: A string representing the expiration date 30 days from today.

    Examples:
        >>> default_expiration_date()
        '2024-06-16'  # This output will vary depending on the current date.
    """
    # Get today's date
    today = date.today()

    # Calculate the expiration date 30 days ahead
    expiration_date = today + timedelta(days=30)

    # Return the expiration date in ISO format
    return expiration_date


def convert_date_to_string(date_obj: date) -> str:
    """
    Converts a date object to a string in the format YYYY-MM-DD.

    Parameters:
    date_obj (datetime.date): The date object to be converted.

    Returns:
    str: The string representation of the date in the format YYYY-MM-DD.

    Example:
    >>> from datetime import date
    >>> convert_date_to_string(date(2024, 5, 21))
    '2024-05-21'
    """
    return date_obj.strftime("%Y-%m-%d")


def custom_jsonable_encoder(obj: Any, seen: Set[int] = None) -> Any:
    """
    Application custom JSON encoder to convert SqlAlchemy object to a JSON object.

    Parameters
    ----------
    obj : Any
        An object to convert.
    seen : Set[int]
        Check if an object is seen before to remove circular reference

    Returns
    -------
    Any
        FastAPI jsonable_encoder object.
    """
    if seen is None:
        seen = set()

    if isinstance(obj, list):
        return [custom_jsonable_encoder(item, seen) for item in obj]

    if isinstance(obj, dict):
        return {key: custom_jsonable_encoder(value, seen) for key, value in obj.items()}

    if hasattr(obj, "__table__"):  # Check if it's an SQLAlchemy model
        obj_id = id(obj)
        if obj_id in seen:
            return {"id": obj.id}  # Simplified representation to avoid recursion
        seen.add(obj_id)

        obj_dict = {}
        # Collect columns from the base class and any inherited classes
        columns = inspect(obj.__class__).columns.keys()
        for column in columns:
            value = getattr(obj, column, None)
            obj_dict[column] = custom_jsonable_encoder(value, seen)

        for relationship in inspect(obj.__class__).relationships:
            try:
                if relationship.lazy == "joined":
                    value = getattr(obj, relationship.key, None)
                else:
                    value = None
                if value is not None:
                    if isinstance(value, list):  # Handle lists of related objects
                        obj_dict[relationship.key] = [
                            custom_jsonable_encoder(item, seen) for item in value
                        ]
                    else:
                        obj_dict[relationship.key] = custom_jsonable_encoder(
                            value, seen
                        )
            except DetachedInstanceError:
                obj_dict[relationship.key] = None
            except AttributeError:
                obj_dict[relationship.key] = None

        return obj_dict

    return jsonable_encoder(obj)
