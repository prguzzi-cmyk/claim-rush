#!/usr/bin/env python

"""User Dependencies"""

from typing import Annotated, Optional

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

# auto_error=False so we can raise our own 401 (not HTTPBearer's default 403)
# when no credentials are supplied.
bearer_security = HTTPBearer(auto_error=False)


def get_current_user(
    db_session: Annotated[Session, Depends(get_db_session)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_security)],
) -> User:
    """
    Retrieve the instance of the current user from a bearer JWT.

    Raises 401 if no token is present or the token is invalid.
    Raises 404 if the token decodes but references a user that no longer exists.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token = credentials.credentials
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = schemas.TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
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
        An User model object

    Returns
    -------
    User
        An User model object of the current active user.
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
        An User model object

    Returns
    -------
    User
        An User model object of the current active superuser.
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
        An User model object

    Returns
    -------
    User
        An User model object of the current active admin user.
    """
    if not crud.user.is_admin_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The user doesn't have enough privileges.",
        )

    return current_user
