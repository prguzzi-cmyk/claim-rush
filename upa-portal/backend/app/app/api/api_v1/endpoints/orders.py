# !/usr/bin/env python

"""Routes for the Cart module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, status, Path, HTTPException, Body
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_db_session, get_current_active_user
from app.core import enums
from app.core.rbac import Modules
from app.models.cart import Cart
from app.models.order_detail import OrderDetail
from app.schemas.account_detail import AccountDetailCreate
from app.schemas.cart import CartCreatedRequest, CartUpdatedRequest
from app.schemas.order import OrderCreate, OrderUpdate
from app.schemas.order_detail import OrderDetailBase
from app.utils.contexts import UserContext
from app.utils.pagination import CustomPage

router = APIRouter()
permissions = Permissions(Modules.SHOP.value)


@router.post(
    "",
    summary="Create orders",
    response_description="Order Created",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.create())
    ]
)
def create_order(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """check out the shopping cart and create order"""
    UserContext.set(current_user.id)
    account = crud.account.get_my_account(db_session, current_user.id)
    carts = crud.cart.get_all(db_session, current_user.id)
    total_amount = 0
    for item in carts:
        total_amount += item.quantity * item.price
    if total_amount > account.account_balance:
        return {'msg': 'No enough account balance'}

    crud.order.create_order(db_session, user_id=current_user.id, carts=carts, total_amount=total_amount)
    return {"msg": "ok"}


@router.get(
    "/me",
    summary="list my orders",
    response_description="list current user order list",
    response_model=CustomPage[schemas.order.OrderMe],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.read())
    ]
)
def get_current_user_order_list(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """get order list for current user"""
    return crud.order.get_my_order_list(db_session, user_id=current_user.id)


@router.get(
    "",
    summary="list all orders",
    response_description="get  order list for shop management",
    response_model=CustomPage[schemas.order.OrderMe],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(Permissions(Modules.SHOP_MANAGEMENT.value).read())
    ]
)
def get_all_user_order_list(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """get order list for current user"""
    return crud.order.get_order_list(db_session)


@router.get(
    "/{order_id}/details",
    summary="list my order details",
    response_description="list current user order detail list",
    response_model=list[OrderDetailBase],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.read())
    ]
)
def get_current_user_order_details(
        order_id: Annotated[UUID, Path(title="order id")],
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """get order detail list for current user"""
    order = crud.order.get(db_session, obj_id=order_id)
    if (order is None) or (order.user_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return crud.order_detail.get_order_detail_list_by_order_id(db_session, order_id=order_id)


@router.get(
    "/{order_id}/details-management",
    summary="get order details for management",
    response_description="order details response",
    response_model=list[OrderDetailBase],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(Permissions(Modules.SHOP_MANAGEMENT.value).read())
    ]
)
def get_all_user_order_details(
        order_id: Annotated[UUID, Path(title="order id")],
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """get order detail list for management"""
    order = crud.order.get(db_session, obj_id=order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return crud.order_detail.get_order_detail_list_by_order_id(db_session, order_id=order_id)


@router.put(
    "/{order_id}",
    summary="update order status",
    response_description="Order status updated",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(Permissions(Modules.SHOP_MANAGEMENT.value).read())
    ]
)
def update_order_status(
        order_id: Annotated[UUID, Path(title="order id")],
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """update order status for management"""
    UserContext.set(current_user.id)
    order = crud.order.get(db_session, obj_id=order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    data = {'id': order.id, 'status': enums.OrderStatus.PROCESSED.value}
    crud.order.update(db_session, db_obj=order, obj_in=data)
    return {'msg': 'Order status updated'}
