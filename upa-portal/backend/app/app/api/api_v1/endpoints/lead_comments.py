#!/usr/bin/env python

"""Routes for the Lead Comments module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.rbac import Modules
from app.core.read_params_attrs import LeadCommentSort, Ordering
from app.models import LeadComment
from app.schemas import LeadCommentCreate
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.lead import validate_lead_ownership
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import LeadSqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.LEAD_COMMENT.value)
crud_util = CrudUtil(crud.lead_comment)
crud_util_lead = CrudUtil(crud.lead)
read_params = CommonReadParams(search_enum=None, sort_enum=LeadCommentSort)
stmt_gen = LeadSqlStmtGenerator(LeadComment)


@router.get(
    "/{lead_id}/comments",
    summary="Read Lead Comments",
    response_description="Lead comments",
    response_model=CustomPage[schemas.LeadComment],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_comments(
    *,
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    sort_by: read_params.sort_by() = LeadCommentSort.created_at,
    order_by: read_params.order_by() = Ordering.asc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of lead comments."""

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    # Apply filter if there is any
    filters_stmt = [
        LeadComment.lead_id == lead_id,
    ]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    return crud.lead_comment.get_multi(
        db_session,
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )


@router.get(
    "/comments/{lead_comment_id}",
    summary="Read Lead Comment By Id",
    response_description="Lead comment data",
    response_model=schemas.LeadComment,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_comment_by_id(
    lead_comment_id: Annotated[UUID, Path(description="Lead comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a lead comment by an id."""

    # Get a lead comment or raise an exception
    lead_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=lead_comment_id
    )

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead_comment.lead_id,
        exception_msg="This lead does not belong to you.",
    )

    return lead_comment


@router.post(
    "/{lead_id}/comments",
    summary="Create Lead Comment",
    response_description="Lead Comment created",
    response_model=schemas.LeadComment,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_lead_comment(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    comment_in: schemas.CommentCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new lead comment."""

    UserContext.set(current_user.id)

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    # Create a comment record in the database
    lead_comment_in = LeadCommentCreate(
        text=comment_in.text,
        can_be_removed=comment_in.can_be_removed,
        lead_id=lead_id,
    )
    comment_obj = crud.lead_comment.create(db_session, obj_in=lead_comment_in)

    return comment_obj


@router.put(
    "/comments/{lead_comment_id}",
    summary="Update Lead Comment",
    response_description="Updated lead comment",
    response_model=schemas.LeadComment,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead_comment(
    lead_comment_id: Annotated[UUID, Path(description="Lead comment ID.")],
    lead_comment_in: schemas.LeadCommentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a lead comment via an ID."""

    UserContext.set(current_user.id)

    # Get a lead comment or raise an exception
    lead_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=lead_comment_id
    )

    # Get a lead or raise an exception
    lead = crud_util_lead.get_object_or_raise_exception(
        db_session, object_id=lead_comment.lead_id
    )

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    lead_comment = crud.lead_comment.update(
        db_session, db_obj=lead_comment, obj_in=lead_comment_in
    )

    return lead_comment


@router.delete(
    "/comments/{lead_comment_id}",
    summary="Remove Lead Comment",
    response_description="Lead Comment removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead_comment(
    lead_comment_id: Annotated[UUID, Path(description="Lead comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a lead comment by providing an ID."""

    # Get a lead comment or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=lead_comment_id)

    crud.lead_comment.remove(db_session, obj_id=lead_comment_id)

    return {"msg": "Comment deleted successfully."}
