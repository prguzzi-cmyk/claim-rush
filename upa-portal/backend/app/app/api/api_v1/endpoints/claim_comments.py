#!/usr/bin/env python

"""Routes for the Claim Comments module"""

from functools import partial
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.core.rbac import Modules, Operations
from app.core.read_params_attrs import ClaimCommentSort, Ordering
from app.models import ClaimComment
from app.schemas import ClaimCommentCreate
from app.core.enums import ClaimActivityType
from app.utils.claim import validate_claim_ownership, validate_claim_role
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClaimSqlStmtGenerator

router = APIRouter()

module = Modules.CLAIM_COMMENT
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim_comment)
crud_util_claim = CrudUtil(crud.claim)
read_params = CommonReadParams(search_enum=None, sort_enum=ClaimCommentSort)
stmt_gen = ClaimSqlStmtGenerator(ClaimComment)
resource_exc_msg = "You do not have permission to modify this claim comment."


@router.get(
    "/{claim_id}/comments",
    summary="Read Claim Comments",
    response_description="Claim comments",
    response_model=CustomPage[schemas.ClaimComment],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_comments(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    sort_by: read_params.sort_by() = ClaimCommentSort.created_at,
    order_by: read_params.order_by() = Ordering.asc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of claim comments."""

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    # Apply filter if there is any
    filters_stmt = [
        ClaimComment.claim_id == claim_id,
    ]

    # Sales rep and client users can only see external comments
    if current_user.role and current_user.role.name in ("sales-rep", "client"):
        filters_stmt.append(ClaimComment.visibility == "external")

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    return crud.claim_comment.get_multi(
        db_session,
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )


@router.get(
    "/comments/{claim_comment_id}",
    summary="Read Claim Comment By Id",
    response_description="Claim comment data",
    response_model=schemas.ClaimComment,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_comment_by_id(
    claim_comment_id: Annotated[UUID, Path(description="Claim comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim comment by an id."""

    # Get a claim comment or raise an exception
    claim_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_comment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_comment.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    return claim_comment


@router.post(
    "/{claim_id}/comments",
    summary="Create Claim Comment",
    response_description="Claim Comment created",
    response_model=schemas.ClaimComment,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_claim_comment(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    comment_in: schemas.CommentCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new claim comment."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.CREATE,
    )

    # Create a comment record in the database
    claim_comment_in = ClaimCommentCreate(
        text=comment_in.text,
        can_be_removed=comment_in.can_be_removed,
        claim_id=claim_id,
    )
    comment_obj = crud.claim_comment.create(db_session, obj_in=claim_comment_in)

    crud.claim.create_activity(
        db_session, claim, ClaimActivityType.COMMENT_ADDED,
        extra_details=f"Comment: {comment_in.text[:80]}"
    )

    return comment_obj


@router.put(
    "/comments/{claim_comment_id}",
    summary="Update Claim Comment",
    response_description="Updated claim comment",
    response_model=schemas.ClaimComment,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim_comment(
    claim_comment_id: Annotated[UUID, Path(description="Claim comment ID.")],
    claim_comment_in: schemas.ClaimCommentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim comment via an ID."""

    UserContext.set(current_user.id)

    # Get a claim comment or raise an exception
    claim_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_comment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_comment.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.UPDATE,
        resource=claim_comment,
        resource_exc_msg=resource_exc_msg,
    )

    claim_comment = crud.claim_comment.update(
        db_session, db_obj=claim_comment, obj_in=claim_comment_in
    )

    return claim_comment


@router.patch(
    "/comments/{claim_comment_id}/restore",
    summary="Restore Claim Comment",
    response_description="Restored Comment data",
    response_model=schemas.ClaimComment,
    dependencies=[
        Depends(permissions.restore()),
    ],
)
def restore_claim_comment(
    claim_comment_id: Annotated[UUID, Path(description="The claim comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Restore a claim comment via an ID."""

    UserContext.set(current_user.id)

    # Get a claim comment or raise an exception
    claim_comment = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=claim_comment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_comment.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.RESTORE,
        resource=claim_comment,
        resource_exc_msg=resource_exc_msg,
    )

    claim_comment = crud.claim_comment.restore(db_session, db_obj=claim_comment)

    return claim_comment


@router.delete(
    "/comments/{claim_comment_id}",
    summary="Remove Claim Comment",
    response_description="Claim Comment removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim_comment(
    claim_comment_id: Annotated[UUID, Path(description="Claim comment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim comment by providing an ID."""

    # Get a claim comment or raise an exception
    claim_comment = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_comment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_comment.claim_id
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.REMOVE,
        resource=claim_comment,
        resource_exc_msg=resource_exc_msg,
    )

    crud.claim_comment.remove(db_session, obj_id=claim_comment_id)

    return {"msg": "Comment deleted successfully."}
