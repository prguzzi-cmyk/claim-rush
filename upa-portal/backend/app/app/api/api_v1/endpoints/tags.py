#!/usr/bin/env python

"""Routes for the Tag module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import Ordering, TagSearch, TagSort
from app.models import Tag, User
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.TAG.value)
crud_util = CrudUtil(crud.tag)
read_params = CommonReadParams(TagSearch, TagSort)
stmt_gen = SqlStmtGenerator(Tag)


@router.get(
    "",
    summary="Read Tags",
    response_description="A list of Tags",
    response_model=CustomPage[schemas.Tag],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_tags(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = TagSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of Tags"""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    tags = crud.tag.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return tags


@router.get(
    "/{tag_id}",
    summary="Read Tag By Id",
    response_description="Tag data",
    response_model=schemas.Tag,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_tag_by_id(
    tag_id: Annotated[UUID, Path(description="The Tag id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a Tag by an id"""

    # Get a Tag or raise an exception
    tag = crud_util.get_object_or_raise_exception(db_session, object_id=tag_id)

    return tag


@router.post(
    "",
    summary="Create Tag",
    response_description="Tag created",
    response_model=schemas.Tag,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_tag(
    tag_in: schemas.TagCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new Tag"""

    UserContext.set(current_user.id)

    tag = crud.tag.create(db_session, obj_in=tag_in)

    return tag


@router.put(
    "/{tag_id}",
    summary="Update Tag",
    response_description="Updated Tag data",
    response_model=schemas.Tag,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_tag(
    tag_id: Annotated[UUID, Path(description="The Tag id")],
    tag_in: schemas.TagUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update a Tag via an ID"""

    UserContext.set(current_user.id)

    # Get a Tag or raise an exception
    tag = crud_util.get_object_or_raise_exception(db_session, object_id=tag_id)

    tag = crud.tag.update(db_session, db_obj=tag, obj_in=tag_in)

    return tag


@router.patch(
    "/{tag_id}/restore",
    summary="Restore Tag",
    response_description="Restored Tag data",
    response_model=schemas.Tag,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_tag(
    tag_id: Annotated[UUID, Path(description="The Tag id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Restore a Tag via an ID"""

    # Get a Tag or raise an exception
    tag = crud_util.get_removed_object_or_raise_exception(db_session, object_id=tag_id)

    tag = crud.tag.restore(db_session, db_obj=tag)

    return tag


@router.delete(
    "/{tag_id}",
    summary="Remove Tag",
    response_description="Tag removed",
    response_model=schemas.Tag,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_tag(
    tag_id: Annotated[UUID, Path(description="The Tag id.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a Tag by providing an ID"""

    # Get a Tag or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=tag_id)

    tag = crud.tag.remove(db_session, obj_id=tag_id)

    return tag
