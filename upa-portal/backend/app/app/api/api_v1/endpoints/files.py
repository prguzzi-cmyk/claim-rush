#!/usr/bin/env python

"""Routes for the files module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.app import CommonReadParams
from app.api.deps.role import at_least_admin_user
from app.core.config import settings
from app.core.log import logger
from app.core.rbac import Modules
from app.core.read_params_attrs import FileSearch, FileSort, Ordering
from app.models import File as FileModel
from app.models import User
from app.schemas import FileCreate
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.FILE.value)
crud_util = CrudUtil(crud.file)
read_params = CommonReadParams(FileSearch, FileSort)
stmt_gen = SqlStmtGenerator(FileModel)


@router.get(
    "",
    summary="Read Files",
    response_description="A list of files",
    response_model=CustomPage[schemas.File],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_files(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = FileSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of Files."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    files = crud.file.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
    )

    return files


@router.get(
    "/{file_id}",
    summary="Read File By Id",
    response_description="File data",
    response_model=schemas.File,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_file_by_id(
    file_id: Annotated[UUID, Path(description="The file id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a file by an id"""

    # Get a file or raise an exception
    file = crud_util.get_object_or_raise_exception(db_session, object_id=file_id)

    return file


@router.get(
    "/tags/{tag_slug}",
    summary="Read Files By Tag",
    response_description="Files data",
    response_model=CustomPage[schemas.File],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_files_by_tag_slug(
    *,
    tag_slug: Annotated[str, Path(description="The tag slug.")],
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = FileSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve all files of a specific tag."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    files = crud.file.get_multi_by_tag_slug(
        db_session,
        tag_slug=tag_slug,
        filters=filters_stmt,
        order_by=orderby_stmt,
    )

    return files


@router.post(
    "",
    summary="Create File",
    response_description="File created",
    response_model=schemas.File,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(description="Uploaded file.")],
    file_name: Annotated[str, Form(max_length=255, description="File name.")],
    description: Annotated[str | None, Form(description="File description.")] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
    tags: Annotated[
        list[str] | None,
        Form(description="A list consist of tags UUID."),
    ] = None,
) -> Any:
    """Create a new file"""

    UserContext.set(current_user.id)

    ext = get_file_extension(file.filename)
    object_name = f"{settings.FILE_DIR_PATH}/{slugify(file_name)}{ext}"

    file_path = f"{settings.FILE_URL_PATH}{slugify(file_name)}{ext}"

    file_in = FileCreate(
        name=file_name,
        type=file.content_type,
        size=file.size,
        path=file_path,
        description=description,
        can_be_removed=can_be_removed,
        tags=tags,
    )

    file_obj = crud.file.create(db_session, obj_in=file_in)

    try:
        file.file.seek(0)

        S3.upload_file_obj(file=file, object_name=object_name)

        return file_obj
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Remove the file record if created
        if file_obj:
            crud.file.remove(db_session, obj_id=file_obj.id)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")


@router.post(
    "/{file_id}/tags",
    summary="Append File Tags",
    response_description="File updated",
    response_model=schemas.File,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
)
def append_file_tags(
    file_id: Annotated[UUID, Path(description="The file id")],
    tags: schemas.FileTagsAppend,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Append a list of tags to the file"""

    # Get a file or raise an exception
    file = crud_util.get_object_or_raise_exception(db_session, object_id=file_id)

    file = crud.file.append_tags(db_session, file_obj=file, tags=tags)

    return file


@router.put(
    "/{file_id}",
    summary="Update File",
    response_description="Updated file data",
    response_model=schemas.File,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_file(
    file_id: Annotated[UUID, Path(description="The file id.")],
    file_in: schemas.FileUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a file via an ID"""

    UserContext.set(current_user.id)

    # Get a file or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=file_id)

    file = crud.file.update(db_session, file_id=file_id, obj_in=file_in)

    return file


@router.delete(
    "/{file_id}",
    summary="Remove File",
    response_description="File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_file(
    file_id: Annotated[UUID, Path(description="The file id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a file by providing an ID"""

    # Get a file or raise an exception
    file_obj = crud_util.get_object_or_raise_exception(db_session, object_id=file_id)

    ext = get_file_extension(file_obj.path)
    object_name = f"{settings.FILE_DIR_PATH}/{slugify(file_obj.name)}{ext}"

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.file.remove(db_session, obj_id=file_id)

    return {"msg": "File deleted successfully."}


@router.delete(
    "/{file_id}/tags",
    summary="Remove File Tags",
    response_description="File updated",
    response_model=schemas.File,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_file_tags(
    file_id: Annotated[UUID, Path(description="The file id")],
    tags: schemas.FileTagsRemove,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove tags from a file by providing a UUID of tag"""

    # Get a file or raise an exception
    file = crud_util.get_object_or_raise_exception(db_session, object_id=file_id)

    file = crud.file.remove_tags(db_session, file_obj=file, tags=tags)

    return file
