#!/usr/bin/env python

"""Routes for the Template Files module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams
from app.core.config import settings
from app.core.enums import FileModules
from app.core.log import logger
from app.core.rbac import Modules, Roles
from app.core.read_params_attrs import Ordering, TemplateFileSearch, TemplateFileSort
from app.models import TemplateFile, User
from app.schemas import TemplateFileProcess, TemplateFileProcessOptional
from app.utils.common import get_file_extension, slugify
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.file import FileUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3
from app.utils.sql_stmt_generator import SqlStmtGenerator
from app.utils.template_file import create_template_file as util_create_template_file
from app.utils.template_file import update_template_file as util_update_template_file
from app.utils.template_file import (
    validate_template_file_access,
    validate_template_file_owner,
)

router = APIRouter()

permissions = Permissions(Modules.TEMPLATE_FILE.value)
crud_util = CrudUtil(crud.template_file)
read_params = CommonReadParams(TemplateFileSearch, TemplateFileSort)
stmt_gen = SqlStmtGenerator(TemplateFile)


@router.get(
    "",
    summary="Read Template Files",
    response_description="Template files",
    response_model=CustomPage[schemas.TemplateFile],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_template_files(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = TemplateFileSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of template files."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    where_stmt = None
    if not crud.user.has_admin_privileges(current_user):
        where_stmt = [
            TemplateFile.created_by_id == current_user.id,
            TemplateFile.created_by.has(
                User.role.has(display_name=Roles.SUPER_ADMIN.value)
            ),
            TemplateFile.created_by.has(User.role.has(display_name=Roles.ADMIN.value)),
        ]

    template_files = crud.template_file.get_records(
        db_session,
        where_stmt=where_stmt,
        filters=filters_stmt,
        order_by=orderby_stmt,
    )

    return template_files


@router.get(
    "/{template_file_id}",
    summary="Read Template File By Id",
    response_description="Template file data",
    response_model=schemas.TemplateFile,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_template_file_by_id(
    template_file_id: Annotated[UUID, Path(description="Template file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a template file by an id."""

    # Get a template file or raise an exception
    template_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=template_file_id
    )

    # Validate template file access
    validate_template_file_access(
        db_session,
        user=current_user,
        template_file_obj=template_file,
        exception_msg="This template file does not belong to you.",
    )

    return template_file


@router.post(
    "",
    summary="Create Template File",
    response_description="Template File created",
    response_model=schemas.TemplateFile,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
async def create_template_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="The template file.")],
    file_name: Annotated[
        str | None, Form(max_length=255, description="Template file name.")
    ] = None,
    description: Annotated[
        str | None, Form(description="Template file description.")
    ] = None,
    state: Annotated[
        str | None, Form(description="Template file state abbreviation.")
    ] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Create a new template file."""

    UserContext.set(current_user.id)

    file_util = FileUtil()

    filenames = file_util.get_formatted_filenames(
        related_type=FileModules.TEMPLATE,
        filename=file.filename,
        proposed_filename=file_name,
    )

    file_obj = TemplateFileProcess(
        name=filenames["filename"],
        slugged_name=filenames["slugged_filename"],
        content=await file.read(),
        type=file.content_type,
        size=file.size,
        description=description,
        state=state,
        can_be_removed=can_be_removed,
    )

    return util_create_template_file(db_session, user=current_user, file_obj=file_obj)


@router.put(
    "/{template_file_id}",
    summary="Update Template File",
    response_description="Updated template file",
    response_model=schemas.TemplateFile,
    dependencies=[
        Depends(permissions.update()),
    ],
)
async def update_template_file(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    template_file_id: Annotated[UUID, Path(description="Template file ID.")],
    file: Annotated[UploadFile | None, File(description="The template file.")] = None,
    file_name: Annotated[
        str | None, Form(max_length=255, description="Template file name.")
    ] = None,
    description: Annotated[
        str | None, Form(description="Template file description.")
    ] = None,
    state: Annotated[
        str | None, Form(description="Template file state abbreviation.")
    ] = None,
    can_be_removed: Annotated[
        bool | None, Form(description="Is the file can be removed?")
    ] = True,
) -> Any:
    """Update a template file via an ID."""

    UserContext.set(current_user.id)

    # Get a template file or raise an exception
    template_file = crud_util.get_object_or_raise_exception(
        db_session, object_id=template_file_id
    )

    # Validate template ownership
    validate_template_file_owner(
        user=current_user,
        template_file_obj=template_file,
        exception_msg="This template does not belong to you.",
    )

    filenames = None

    if file_name:
        filenames = {"filename": file_name, "slugged_filename": None}

    if file:
        file_util = FileUtil()

        filenames = file_util.get_formatted_filenames(
            related_type=FileModules.TEMPLATE,
            filename=file.filename,
            proposed_filename=file_name,
        )

    file_obj = TemplateFileProcessOptional(
        name=filenames["filename"] if filenames else None,
        slugged_name=filenames["slugged_filename"] if filenames else None,
        content=await file.read() if file else None,
        type=file.content_type if file else None,
        size=file.size if file else None,
        description=description,
        state=state,
        can_be_removed=can_be_removed,
    )

    return util_update_template_file(
        db_session,
        user=current_user,
        template_file_obj=template_file,
        file_obj=file_obj,
    )


@router.delete(
    "/{template_file_id}",
    summary="Remove Template File",
    response_description="Template File removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_template_file(
    template_file_id: Annotated[UUID, Path(description="Template file ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a template file by providing an ID."""

    # Get a template file or raise an exception
    template_file_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=template_file_id
    )

    ext = get_file_extension(template_file_obj.path)
    object_name = (
        f"{settings.TEMPLATE_FILE_DIR_PATH}/{slugify(template_file_obj.name)}{ext}"
    )

    try:
        S3.delete_file_obj(object_name=object_name)
    except Exception as e:
        # Log Exception
        logger.error(e)

        # Raise exception
        exc_internal_server("An error occurred while processing the file.")

    crud.template_file.remove(db_session, obj_id=template_file_id)

    return {"msg": "Template file deleted successfully."}
