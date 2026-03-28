#!/usr/bin/env python

"""Routes for the Category module"""
import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_db_session, get_current_active_user
from app.core.rbac import Modules
from app.models.category import Category
from app.schemas.category import CategoryCreateRequest, CategoryCreateResponse
from app.utils.contexts import UserContext
from app.utils.exceptions import exc_internal_server
from app.utils.pagination import CustomPage

router = APIRouter()

# crud_category = CrudUtil(crud.category)
permissions = Permissions(Modules.SHOP_MANAGEMENT.value)


@router.post(
    "",
    summary="Create A New Category",
    response_description="Category Created",
    response_model=schemas.category.CategoryCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(permissions.create())
    ]
)
def create_category(
        request: CategoryCreateRequest,
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """create a new category"""

    UserContext.set(current_user.id)

    if request.parent_id == '':
        request.parent_id = None
    category = crud.category.create(db_session, obj_in=request)
    return CategoryCreateResponse.from_orm(category)


@router.put(
    "/{category_id}",
    summary="Update A Category",
    response_description="Category Updated",
    response_model=schemas.category.CategoryUpdateResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.update())
    ]
)
def update_category(
        category_id: Annotated[UUID, Path(description="The category id")],
        request: schemas.category.CategoryUpdateRequest,
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """update a category"""

    UserContext.set(current_user.id)

    category = crud.category.get(db_session, obj_id=category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The category with id does not exist in the system",
        )
    category.updated_at = datetime.datetime.now()
    category = crud.category.update(db_session, db_obj=category, obj_in=request)
    return schemas.category.CategoryUpdateResponse.from_orm(category)


@router.get(
    "",
    summary="Read Category List",
    response_description="A list of category",
    response_model=CustomPage[schemas.category.CategoryBase],
    status_code=status.HTTP_200_OK,
)
def get_category_list(
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """get category list"""
    return crud.category.get_multi(db_session)


@router.get(
    "/all",
    summary="Read All Category List",
    response_description="A list of category",
    response_model=list[schemas.category.CategoryBase],
    status_code=status.HTTP_200_OK,
)
def get_category_list(
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """get all category list"""
    category_list = crud.category.get_all(db_session)
    return category_list


@router.delete(
    "/{category_id}",
    summary="Delete Category",
    response_description="Category deleted",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove())
    ]
)
def delete_category(
        category_id: Annotated[UUID, Path(description="The category id")],
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a category by providing an ID"""
    # cannot remove the category which has child
    category_child_list = crud.category.get_all_by_category_id(category_id)
    if category_child_list:
        exc_internal_server("Record deleted failed, please remove child category first.")
    category = crud.category.get(db_session, obj_id=category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The category with this id does not exist in the system",
        )
    msg = crud.category.hard_remove(db_session, obj_id=category_id)
    return msg
