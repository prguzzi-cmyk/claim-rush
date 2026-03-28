#!/usr/bin/env python

"""Routes for the Client Comments module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.rbac import Modules
from app.core.read_params_attrs import ClientCommentSort, Ordering
from app.models import ClientComment
from app.schemas import ClientCommentCreate
from app.utils.client import validate_client_ownership
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClientSqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.CLIENT_COMMENT.value)
crud_util = CrudUtil(crud.client_comment)
crud_util_client = CrudUtil(crud.client)
read_params = CommonReadParams(search_enum=None, sort_enum=ClientCommentSort)
stmt_gen = ClientSqlStmtGenerator(ClientComment)


@router.get(
    "/{client_id}/comments",
    summary="Read Client Comments",
    response_description="Client comments",
    response_model=CustomPage[schemas.ClientComment],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_comments(
    *,
    client_id: Annotated[UUID, Path(description="The client ID.")],
    sort_by: read_params.sort_by() = ClientCommentSort.created_at,
    order_by: read_params.order_by() = Ordering.asc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of client comments."""

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    # Apply filter if there is any
    filters_stmt = [
        ClientComment.client_id == client_id,
    ]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    return crud.client_comment.get_multi(
        db_session,
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )


@router.get(
    "/comments/{client_comment_id}",
    summary="Read Client Comment By Id",
    response_description="Client comment data",
    response_model=schemas.ClientComment,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_client_comment_by_id(
    client_comment_id: Annotated[UUID, Path(description="Client comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a client comment by an id."""

    # Get a client comment or raise an exception
    client_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_comment_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client_comment.client_id,
        exception_msg="This client does not belong to you.",
    )

    return client_comment


@router.post(
    "/{client_id}/comments",
    summary="Create Client Comment",
    response_description="Client Comment created",
    response_model=schemas.ClientComment,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_client_comment(
    client_id: Annotated[UUID, Path(description="The client ID.")],
    comment_in: schemas.CommentCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new client comment."""

    UserContext.set(current_user.id)

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    # Create a comment record in the database
    client_comment_in = ClientCommentCreate(
        text=comment_in.text,
        can_be_removed=comment_in.can_be_removed,
        client_id=client_id,
    )
    comment_obj = crud.client_comment.create(db_session, obj_in=client_comment_in)

    return comment_obj


@router.put(
    "/comments/{client_comment_id}",
    summary="Update Client Comment",
    response_description="Updated client comment",
    response_model=schemas.ClientComment,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_client_comment(
    client_comment_id: Annotated[UUID, Path(description="Client comment ID.")],
    client_comment_in: schemas.ClientCommentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a client comment via an ID."""

    UserContext.set(current_user.id)

    # Get a client comment or raise an exception
    client_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=client_comment_id
    )

    # Get a client or raise an exception
    client = crud_util_client.get_object_or_raise_exception(
        db_session, object_id=client_comment.client_id
    )

    # Validate client ownership
    validate_client_ownership(
        user=current_user,
        client_obj=client,
        exception_msg="This client does not belong to you.",
    )

    client_comment = crud.client_comment.update(
        db_session, db_obj=client_comment, obj_in=client_comment_in
    )

    return client_comment


@router.delete(
    "/comments/{client_comment_id}",
    summary="Remove Client Comment",
    response_description="Client Comment removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_client_comment(
    client_comment_id: Annotated[UUID, Path(description="Client comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a client comment by providing an ID."""

    # Get a client comment or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=client_comment_id)

    crud.client_comment.remove(db_session, obj_id=client_comment_id)

    return {"msg": "Comment deleted successfully."}
