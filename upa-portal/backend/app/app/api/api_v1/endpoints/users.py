#!/usr/bin/env python

"""Routes for the User module"""

from typing import Annotated, Any
from uuid import UUID

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status
from fastapi_pagination import paginate
from sqlalchemy.orm import Session
from starlette.background import BackgroundTasks

from app import crud, models, schemas
from app.api import deps
from app.api.deps import Permissions, get_db_session
from app.api.deps.app import CommonReadParams, get_service_locator
from app.api.deps.role import at_least_admin_user
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.core.read_params_attrs import UserSearch, UserSort, Ordering
from app.core.response_manager import ResponseManager
from app.models import User
from app.service_locator import AppServiceLocator
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.emails import send_new_account_email
from app.utils.exceptions import CrudUtil
from app.utils.img import is_valid_image
from app.utils.pagination import CustomPage
from app.utils.s3 import S3
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

response_manager = ResponseManager()
permissions = Permissions(Modules.USER.value)
permissions_profile = Permissions(Modules.PROFILE.value)
crud_util = CrudUtil(crud.user)
read_params = CommonReadParams(UserSearch, UserSort)
stmt_gen = SqlStmtGenerator(User)


@router.get(
    "",
    summary="Read Users",
    response_description="A list of users",
    response_model=CustomPage[schemas.User],
    dependencies=[Depends(permissions.read())],
)
def read_users(
    *,
    sort_by: read_params.sort_by() = UserSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all users"""

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    users = crud.user.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        order_by=orderby_stmt,
    )

    return users


@router.get(
    "/role/{role_name}",
    summary="Read Users by Role",
    response_description="A list of users.",
    response_model=CustomPage[schemas.User],
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.read())],
)
def read_role_by_name(
    role_name: Annotated[str, Path(example="agent", description="Role name.")],
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all users of a specific role"""

    role = crud.role.get_by_name(db_session, name=role_name)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The role with this name doesn't exist in the system.",
        )

    users = crud.user.get_multi_by_role(db_session, role_id=role.id)

    return users


@router.post(
    "",
    summary="Create User",
    response_description="User created",
    response_model=schemas.User,
    responses=response_manager.get_user_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_409_CONFLICT,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ]
    ),
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_in: schemas.UserCreate,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    background_tasks: BackgroundTasks,
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """
    Create a new user in the system and send a welcome email.

    This endpoint takes the necessary data to create a new user, persists it
    in the database, and sends a welcome email asynchronously using background tasks.
    """

    UserContext.set(current_user.id)

    user_service = service_locator.get_user_service()

    user_entity = user_service.create_user(user_in)

    background_tasks.add_task(
        send_new_account_email,
        user=user_entity,
    )

    return user_entity


@router.get(
    "/me",
    summary="Read User Me",
    response_description="User data",
    response_model=schemas.UserProfile,
    dependencies=[
        Depends(permissions_profile.read()),
    ],
)
def read_user_me(
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Get current user data"""
    obj = current_user.__dict__

    return {
        **obj,
        "permissions": crud.permission.get_user_permissions(user=current_user),
    }


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

    UserContext.set(current_user.id)

    user = crud.user.update(db_session, obj_id=current_user.id, obj_in=user_in)

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
    """Add new avatar for a user."""

    UserContext.set(current_user.id)

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
    user_id: Annotated[UUID, Path(description="The user's ID.")],
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


@router.get(
    "/{user_id}/permissions",
    summary="Read User Permissions",
    response_description="User Permissions data",
    response_model=CustomPage[schemas.PermissionMinimal],
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions_profile.read()),
    ],
)
def read_user_permissions(
    user_id: Annotated[UUID, Path(description="The user's ID.")],
    db_session: Annotated[Session, Depends(deps.get_db_session)],
) -> Any:
    """Get the user permissions."""

    user = crud.user.get(db_session, obj_id=user_id)

    # If there is no user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return paginate(crud.permission.get_user_permissions(user=user))


@router.put(
    "/{user_id}",
    summary="Update User",
    response_description="Updated user data",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.update())],
)
def update_user(
    user_id: Annotated[UUID, Path(description="The user's ID.")],
    user_in: schemas.UserUpdate,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_active_user)],
) -> Any:
    """Update a user with an ID"""

    UserContext.set(current_user.id)

    user = crud.user.get(db_session, obj_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The user with this username does not exist in the system",
        )

    user = crud.user.update(db_session, obj_id=user_id, obj_in=user_in)

    return user


@router.delete(
    "/{user_id}",
    summary="Remove User",
    response_description="User removed",
    response_model=schemas.User,
    dependencies=[Depends(at_least_admin_user()), Depends(permissions.remove())],
)
def remove_user(
    user_id: Annotated[UUID, Path(description="The user's ID.")],
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
