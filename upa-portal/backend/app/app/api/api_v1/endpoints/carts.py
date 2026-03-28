# !/usr/bin/env python

"""Routes for the Cart module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, status, Path, HTTPException, Body
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_db_session, get_current_active_user
from app.core.rbac import Modules
from app.models.cart import Cart
from app.schemas.account_detail import AccountDetailCreate
from app.schemas.cart import CartCreatedRequest, CartUpdatedRequest
from app.utils.contexts import UserContext
from app.utils.pagination import CustomPage

router = APIRouter()
permissions = Permissions(Modules.SHOP.value)


@router.post(
    "",
    summary="Add product to cart",
    response_description="Cart Added",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.create())
    ]
)
def add_to_cart(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
        request: CartCreatedRequest
) -> Any:
    """add product to cart"""
    UserContext.set(current_user.id)

    request.user_id = current_user.id
    crud.cart.create(db_session, obj_in=request)
    return {"msg": "Added to shopping cart"}


@router.get(
    "",
    summary="Read Cart List",
    response_description="A list of cart",
    response_model=list[schemas.cart.CartBase],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.read())
    ]
)
def get_cart_list(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """get cart list"""

    carts = crud.cart.get_all(db_session, current_user.id)
    return carts


@router.delete(
    "/{cart_id}",
    summary="Delete Cart",
    response_description="Cart deleted",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove())
    ]
)
def delete_category(
        cart_id: Annotated[UUID, Path(description="The category id")],
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Remove a cart by providing an ID"""
    cart = crud.cart.get(db_session, obj_id=cart_id)
    if not cart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The cart with this id does not exist in the system",
        )
    msg = crud.cart.hard_remove(db_session, obj_id=cart_id)
    return msg


@router.put(
    "",
    summary="Update Cart",
    response_description="Cart Updated",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.update())
    ]
)
def update_cart(
        request: Annotated[list[CartUpdatedRequest], Body()],
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """update a cart"""

    UserContext.set(current_user.id)

    for item in request:
        cart_item = crud.cart.get(db_session, obj_id=item.id)
        if not cart_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The cart item with id does not exist in the system",
            )
        crud.cart.update(db_session, db_obj=cart_item, obj_in=item)
    return {"msg": "shopping cart has been updated."}
