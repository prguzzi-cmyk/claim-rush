#!/usr/bin/env python

"""Routes for the newsletters module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam
from app.api.deps.role import at_least_admin_user
from app.core.rbac import Modules
from app.core.read_params_attrs import NewsletterSearch, NewsletterSort, Ordering
from app.models import Newsletter as NewsletterModel
from app.models import User
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()

permissions = Permissions(Modules.NEWSLETTER.value)
crud_util = CrudUtil(crud.newsletter)
read_params = CommonReadParams(NewsletterSearch, NewsletterSort)
stmt_gen = SqlStmtGenerator(NewsletterModel)


@router.get(
    "",
    summary="Read Newsletters",
    response_description="A list of newsletters",
    response_model=CustomPage[schemas.Newsletter],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_newsletters(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = NewsletterSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of Newsletters."""

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    newsletters = crud.newsletter.get_multi(
        db_session,
        join_target=stmt_gen.join_stmt(),
        filters=filters_stmt,
        order_by=orderby_stmt,
        removed=removed.only_removed,
    )

    return newsletters


@router.get(
    "/{newsletter_id}",
    summary="Read Newsletter By Id",
    response_description="Newsletter data",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_newsletter_by_id(
    newsletter_id: Annotated[UUID, Path(description="The newsletter id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a newsletter by an id"""

    # Get a newsletter or raise an exception
    newsletter = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    return newsletter


@router.get(
    "/tags/{tag_slug}",
    summary="Read Newsletters By Tag",
    response_description="Newsletters data",
    response_model=CustomPage[schemas.Newsletter],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_newsletters_by_tag_slug(
    db_session: Annotated[Session, Depends(get_db_session)],
    tag_slug: Annotated[str, Path(description="The tag slug.")],
) -> Any:
    """Retrieve all newsletters of a specific tag."""

    # Get a newsletter or raise an exception
    newsletter = crud.newsletter.get_multi_by_tag_slug(db_session, tag_slug=tag_slug)

    return newsletter


@router.post(
    "",
    summary="Create Newsletter",
    response_description="Newsletter created",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_newsletter(
    newsletter_in: schemas.NewsletterCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Create a new newsletter."""

    UserContext.set(current_user.id)

    newsletter_obj = crud.newsletter.create(db_session, obj_in=newsletter_in)

    return newsletter_obj


@router.post(
    "/{newsletter_id}/tags",
    summary="Append Newsletter Tags",
    response_description="Newsletter updated",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
)
def append_newsletter_tags(
    newsletter_id: Annotated[UUID, Path(description="The newsletter id")],
    tags: schemas.TagsAppend,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Append a list of tags to the newsletter"""

    # Get a newsletter or raise an exception
    newsletter = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    newsletter = crud.newsletter.append_tags(
        db_session, newsletter_obj=newsletter, tags=tags
    )

    return newsletter


@router.put(
    "/{newsletter_id}",
    summary="Update Newsletter",
    response_description="Updated newsletter data",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.update()),
    ],
)
def update_newsletter(
    newsletter_id: Annotated[UUID, Path(description="The newsletter id.")],
    newsletter_in: schemas.NewsletterUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Update a newsletter via an ID"""

    UserContext.set(current_user.id)

    # Get a newsletter or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=newsletter_id)

    newsletter = crud.newsletter.update(
        db_session, newsletter_id=newsletter_id, obj_in=newsletter_in
    )

    return newsletter


@router.patch(
    "/{newsletter_id}/restore",
    summary="Restore Newsletter",
    response_description="Restored Newsletter data",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.restore()),
    ],
)
def restore_newsletter(
    newsletter_id: Annotated[UUID, Path(description="The Newsletter ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> Any:
    """Restore a newsletter via an ID."""

    UserContext.set(current_user.id)

    # Get a newsletter or raise an exception
    newsletter = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    newsletter = crud.newsletter.restore(db_session, db_obj=newsletter)

    return newsletter


@router.delete(
    "/{newsletter_id}",
    summary="Remove Newsletter",
    response_description="Newsletter removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_newsletter(
    newsletter_id: Annotated[UUID, Path(description="The newsletter id")],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a newsletter by providing an ID"""

    # Get a newsletter or raise an exception
    crud_util.get_object_or_raise_exception(db_session, object_id=newsletter_id)

    crud.newsletter.remove(db_session, obj_id=newsletter_id)

    return {"msg": "Newsletter deleted successfully."}


@router.delete(
    "/{newsletter_id}/tags",
    summary="Remove Newsletter Tags",
    response_description="Newsletter updated",
    response_model=schemas.Newsletter,
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.remove()),
    ],
)
def remove_newsletter_tags(
    newsletter_id: Annotated[UUID, Path(description="The newsletter id")],
    tags: schemas.TagsRemove,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove tags from a newsletter by providing a UUID of tag"""

    # Get a newsletter or raise an exception
    newsletter = crud_util.get_object_or_raise_exception(
        db_session, object_id=newsletter_id
    )

    newsletter = crud.newsletter.remove_tags(
        db_session, newsletter_obj=newsletter, tags=tags
    )

    return newsletter
