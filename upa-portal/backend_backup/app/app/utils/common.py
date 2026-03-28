#!/usr/bin/env python

"""Common utility functions for the application"""

import pathlib
import re
from datetime import datetime, timedelta
from functools import reduce
from pathlib import Path

from jose import jwt

from app.core.config import settings


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
