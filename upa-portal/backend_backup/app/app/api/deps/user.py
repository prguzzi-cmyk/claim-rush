#!/usr/bin/env python

"""User Dependencies"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
    OAuth2PasswordBearer,
)
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import get_db_session
from app.core import security
from app.core.config import settings
from app.models import User

# Oauth scheme to generate an access token
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/access-token"
)

bearer_security = HTTPBearer()


def get_current_user(
    db_session: Annotated[Session, Depends(get_db_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_security)],
) -> User:
    """
    Retrieve the instance of the current user.

    Parameters
    ----------
    db_session : Session
        Database session
    credentials : HTTPAuthorizationCredentials
        HTTP Bearer type Authorization credentials

    Returns
    -------
    User
        User model object.
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = schemas.TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials.",
        )

    user = crud.user.get(db_session, obj_id=token_data.sub)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )

    return user


def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Retrieve the instance of the current user and check if the user is active.

    Parameters
    ----------
    current_user : User
        User model object

    Returns
    -------
    User
        User model object of the current active user.
    """
    if not crud.user.is_active(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
        )

    return current_user


def get_current_active_superuser(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Retrieve the instance of the currently active user and check if it is a superuser.

    Parameters
    ----------
    current_user : User
        User model object

    Returns
    -------
    User
        User model object of the current active superuser.
    """
    if not crud.user.is_superuser(current_user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The user doesn't have enough privileges.",
        )

    return current_user


def get_current_active_admin_user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Retrieve the instance of the currently active user and check if it is an admin user.

    Parameters
    ----------
    current_user : User
        User model object

    Returns
    -------
    User
        User model object of the current active admin user.
    """
    if not crud.user.is_admin_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The user doesn't have enough privileges.",
        )

    return current_user
