#!/usr/bin/env python

from datetime import datetime, timedelta
from typing import Any

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
