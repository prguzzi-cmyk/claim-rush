#!/usr/bin/env python

import random
import string
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compare the provided plain password with the hashed password

    Parameters
    ----------
    plain_password : str
        Plain Password
    hashed_password : str
        Hashed Password

    Returns
    -------
    bool
        Returns True if verified successfully otherwise False.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Converts plain text password to hashed password.

    Parameters
    ----------
    password : str
        Plain text password

    Returns
    -------
    str
        Returns hashed password
    """
    return pwd_context.hash(password)


def encrypt_string(value: str) -> str:
    """
    Encrypt a string with the help of Cryptography library.

    Parameters
    ----------
    value : str
        String to encode

    Returns
    -------
    str:
        Encrypted string
    """
    cipher_suite = Fernet(settings.FERNET_KEY)
    encrypted_string = cipher_suite.encrypt(value.encode()).decode()

    return encrypted_string


def decrypt_string(value: str) -> str:
    """
    Decrypt a string with the help of Cryptography library.

    Parameters
    ----------
    value : str
        String to decode

    Returns
    -------
    str:
        Decrypted string
    """
    cipher_suite = Fernet(settings.FERNET_KEY)
    decrypted_string = cipher_suite.decrypt(value).decode()

    return decrypted_string


def generate_random_password(length: int = 12) -> str:
    """
    Generates a random password of specified length.

    Parameters
    ----------
    length : int
        The length of the password

    Returns
    -------
    str
        Generated password
    """
    # Define characters to use in the password
    characters = string.ascii_letters + string.digits + string.punctuation

    # Generate a random password using the defined characters
    password = "".join(random.choice(characters) for _ in range(length))

    return password


def create_access_token(
    subject: str | Any, expires_delta: timedelta | None = None
) -> str:
    """
    Creates a new access token.

    Parameters
    ----------
    subject : str or Any
        Subject of a token
    expires_delta : timedelta
        Expire time for the token

    Returns
    -------
    str
        Returns a new access token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def validate_lock(obj: Any) -> None:
    """
    Validates if record is locked.

    Parameters
    ----------
    obj : Any
        Model object

    Raises
    ------
    HTTPException
        If record is locked then it raise exception.
    """
    if hasattr(obj, "can_be_removed") and not obj.can_be_removed:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="A locked record can't be deleted.",
        )


def is_removed(obj: Any) -> None:
    """
    Validates if the record is removed.

    Parameters
    ----------
    obj : Any
        Model object

    Raises
    ------
    HTTPException
        If the record is not removed then it raise an exception.
    """
    if hasattr(obj, "is_removed") and not obj.is_removed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="It is not a removed record.",
        )


def is_valid_uuid(value: str) -> bool:
    """
    Check if string is a valid UUID.

    Parameters
    ----------
    value : str
        String to test against UUID.

    Returns
    -------
    bool
        `True` is string is a valid UUID, otherwise `False`.

    Examples
    --------
    >>> is_valid_uuid('c9bf9e57-1685-4c89-bafb-ff5af830be8a')
    True
    """
    try:
        uuid_obj = UUID(value)
    except ValueError:
        return False

    return str(uuid_obj) == value


def is_valid_iso_date(value: str) -> bool:
    """
    Check if string is a valid ISO Date format.

    Parameters
    ----------
    value : str
        String to test against date function.

    Returns
    -------
    bool
        `True` is string is a valid ISO Date, otherwise `False`.

    Examples
    --------
    >>> is_valid_iso_date('2023-08-06')
    True
    """
    try:
        date_obj = date.fromisoformat(value)
    except ValueError:
        return False

    return str(date_obj) == value
