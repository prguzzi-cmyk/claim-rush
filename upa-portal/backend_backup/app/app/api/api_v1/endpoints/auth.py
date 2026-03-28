#!/usr/bin/env python

"""Authentication Routes"""

from datetime import timedelta
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    HTTPException,
    Path,
    Query,
    status,
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.security import get_password_hash
from app.utils.common import generate_password_reset_token, verify_password_reset_token
from app.utils.emails import send_reset_password_email

router = APIRouter()


@router.post("/access-token", response_model=schemas.Token, deprecated=True)
def auth_access_token(
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = crud.user.authenticate(
        db_session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    elif not crud.user.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post(
    "/login",
    summary="Get an access token",
    response_description="Access token",
    response_model=schemas.Token,
    status_code=status.HTTP_201_CREATED,
)
def login(
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    username: Annotated[str, Query(description="The user name")],
    password: Annotated[str, Query(description="The user password")],
) -> Any:
    """
    Get an access token for future requests.
    """
    user = crud.user.authenticate(db_session, email=username, password=password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    elif not crud.user.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post(
    "/test-token",
    summary="Test access token",
    response_description="Current user object",
    response_model=schemas.User,
)
def test_token(
    current_user: Annotated[models.User, Depends(deps.get_current_user)]
) -> Any:
    """Get the current user object from the access token."""
    return current_user


@router.post(
    "/password-recovery/{email}",
    summary="Recover Password",
    response_description="Password recovery email response",
    response_model=schemas.Msg,
)
def recover_password(
    email: Annotated[str, Path(description="The user's email address")],
    background_tasks: BackgroundTasks,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Generate a request to reset the password."""
    user = crud.user.get_by_email(db_session, email=email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this username doesn't exist in the system.",
        )

    password_reset_token = generate_password_reset_token(email=email)

    background_tasks.add_task(
        send_reset_password_email,
        to=user.email,
        email=email,
        token=password_reset_token,
    )

    return {"msg": "Password recovery email sent"}


@router.post(
    "/reset-password",
    summary="Reset Password",
    response_description="Password update response",
    response_model=schemas.Msg,
)
def reset_password(
    token: Annotated[
        str, Body(description="Existing temporary token to reset the password.")
    ],
    new_password: Annotated[str, Body(description="New password for the user.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Update the user with a new password."""
    email = verify_password_reset_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token"
        )

    user = crud.user.get_by_email(db_session, email=email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this username does not exist in the system.",
        )
    elif not crud.user.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    with db_session as session:
        hashed_password = get_password_hash(new_password)
        user.hashed_password = hashed_password

        session.add(user)
        session.commit()

    return {"msg": "Password updated successfully"}
