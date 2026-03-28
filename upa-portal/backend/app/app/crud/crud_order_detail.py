#!/usr/bin/env python

"""CRUD operations for the order detail model"""
from decimal import Decimal
from typing import Sequence, Type

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import UUID, func
from sqlalchemy.orm import Session

from app.core import enums
from app.crud.base import CRUDBase
from app.models import User
from app.models.account import Account
from app.models.account_detail import AccountDetail
from app.models.cart import Cart
from app.models.order import Order
from app.models.order_detail import OrderDetail
from app.schemas.order_detail import OrderDetailCreate, OrderDetailUpdate


class CRUDOrderDetail(CRUDBase[OrderDetail, OrderDetailCreate, OrderDetailUpdate]):

    @staticmethod
    def get_order_detail_list_by_order_id(db_session: Session, *, order_id: UUID) -> list[Type[OrderDetail]]:
        with db_session as session:
            query = session.query(OrderDetail).filter(OrderDetail.order_id == order_id)
            return query.all()


order_detail = CRUDOrderDetail(OrderDetail)
