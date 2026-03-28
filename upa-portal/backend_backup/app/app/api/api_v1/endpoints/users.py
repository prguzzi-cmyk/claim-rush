#!/usr/bin/env python

"""Routes for the User module"""

from typing import Annotated, Any
from uuid import UUID

from botocore.exceptions import ClientError
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session
from starlette.background import BackgroundTasks

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions, get_db_session
from app.api.deps.role import at_least_admin_user
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.utils.common import get_file_extension
from app.utils.emails import send_new_account_email
from app.utils.img import is_valid_image
from app.utils.s3 import S3

router = APIRouter()

permissions = Permissions(Modules.USER.value)
permissions_profile = Permissions(Modules.PROFILE.value)


@router.get(
    "",
    summary="Read Users",
    response_description="A list of users",
    response_model=list[schemas.User],
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_users(
    *,
    skip: Annotated[int, Query(description="Number of records to skip")] = 0,
    limit: Annotated[int, Query(description="Number of records to fetch")] = 100,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all users"""
    users = crud.user.get_multi(db_session, skip=skip, limit=limit)
    return users


@router.post(
    "",
    summary="Create User",
    response_description="User created",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_in: schemas.UserCreate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    background_tasks: BackgroundTasks,
) -> Any:
    """Create a new user"""
    user = crud.user.get_by_email(db_session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with the username already exists in the system",
        )

    user = crud.user.create(db_session, obj_in=user_in)

    background_tasks.add_task(
        send_new_account_email,
        user=user,
    )

    return user


@router.get(
    "/me",
    summary="Read User Me",
    response_description="User data",
    response_model=schemas.User,
    dependencies=[
        Depends(permissions_profile.read()),
    ],
)
def read_user_me(
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Get current user data"""
    return current_user


@router.put(
    "/me",
    summary="Update User Me",
    response_description="User updated",
    response_model=schemas.User,
    dependencies=[
        Depends(permissions_profile.update()),
    ],
)
def update_user_me(
    *,
    user_in: schemas.UserUpdateMe,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Update own user"""
    user = crud.user.update(db_session, db_obj=current_user, obj_in=user_in)

    return user


@router.post(
    "/avatar",
    summary="User Avatar",
    response_description="Success response",
    response_model=schemas.User,
    dependencies=[
        Depends(permissions_profile.update()),
    ],
)
async def user_avatar(
    avatar: Annotated[UploadFile, File(description="Avatar file")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    ext = ""
    if avatar.filename:
        ext = get_file_extension(avatar.filename)

    object_name = f"avatar/{current_user.id}{ext}"

    if not is_valid_image(avatar):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The provided avatar image is not valid.",
        )

    if avatar.content_type not in settings.WHITELISTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Image type is not valid. "
            f"Only {settings.WHITELISTED_IMAGE_TYPES} are allowed.",
        )

    if avatar.size and avatar.size > settings.AVATAR_FILE_MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size is greate than {settings.AVATAR_FILE_MAX_SIZE} bytes.",
        )

    try:
        avatar.file.seek(0)

        S3.upload_file_obj(file=avatar, object_name=object_name)

        avatar_path = f"{settings.AVATAR_PATH}{current_user.id}{ext}"

        user = crud.user.update_avatar(
            db_session, db_obj=current_user, avatar=avatar_path
        )

        return user
    except ClientError as e:
        logger.error(e)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the image.",
        )


@router.get(
    "/{user_id}",
    summary="Read User By Id",
    response_description="User data",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_user_by_id(
    user_id: Annotated[UUID, Path(description="The user's id")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Get a specific user by id"""
    user = crud.user.get(db_session, obj_id=user_id)

    # If there is no user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # If found user is the current user
    if user == current_user:
        return user

    return user


@router.put(
    "/{user_id}",
    summary="Update User",
    response_description="Updated user data",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.update())],
)
def update_user(
    user_id: Annotated[UUID, Path(description="The user's id")],
    user_in: schemas.UserUpdate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Update a user with an ID"""
    user = crud.user.get(db_session, obj_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this username does not exist in the system",
        )

    user = crud.user.update(db_session, db_obj=user, obj_in=user_in)

    return user


@router.delete(
    "/{user_id}",
    summary="Remove User",
    response_description="User removed",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.remove())],
)
def remove_user(
    user_id: Annotated[UUID, Path(description="The user's id")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Remove a user by providing an ID"""
    user = crud.user.get(db_session, obj_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this username does not exist in the system",
        )

    user = crud.user.remove(db_session, obj_id=user_id)

    return user
