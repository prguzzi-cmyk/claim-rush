#!/usr/bin/env python

"""CRUD operations for the order model"""
from decimal import Decimal
from typing import Sequence

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
from app.schemas.order import OrderCreate, OrderUpdate
from fastapi_pagination.ext.sqlalchemy import paginate


class CRUDOrder(CRUDBase[Order, OrderCreate, OrderUpdate]):

    @staticmethod
    def get_my_order_list(db_session: Session, *, user_id: UUID):
        with db_session as session:
            query = session.query(Order.id, Order.user_id, Order.total_amount, Order.status, Order.created_at,
                                  Order.updated_at,
                                  func.concat(User.first_name, User.last_name).label('user_name'),
                                  User.email
                                  ).join(User, Order.user_id == User.id).filter(Order.user_id == user_id)
            return paginate(query)

    @staticmethod
    def get_order_list(db_session: Session):
        with db_session as session:
            query = session.query(Order.id, Order.user_id, Order.total_amount, Order.status, Order.created_at,
                                  Order.updated_at,
                                  func.concat(User.first_name, User.last_name).label('user_name'),
                                  User.email
                                  ).join(User, Order.user_id == User.id)
            return paginate(query)

    @staticmethod
    def create_order(db_session: Session, *, user_id: UUID, carts: Sequence[Cart], total_amount: Decimal):
        try:
            with db_session as session:
                session.begin()
                # create order
                new_order = Order(user_id=user_id, total_amount=total_amount, status=enums.OrderStatus.PENDING.value)
                session.add(new_order)
                session.flush()
                # create order details
                order_detail_list = list()
                for item in carts:
                    if item.quantity > 0:
                        order_detail = OrderDetail(order_id=new_order.id, product_id=item.product_id,
                                                   product_name=item.product_name, product_image=item.product_image,
                                                   price=item.price, quantity=item.quantity)
                        order_detail_list.append(order_detail)
                session.add_all(order_detail_list)
                # remove all cart items
                cart_items = session.query(Cart).filter(Cart.user_id == user_id)
                for item in cart_items:
                    session.delete(item)
                # subtract account mount
                account = session.query(Account).filter(Account.user_id == user_id).first()
                new_account_detail = AccountDetail(account_id=account.id, amount=-total_amount,
                                                   summary=f'#order: {new_order.id}')
                session.add(new_account_detail)
                account.account_balance -= total_amount
                session.add(account)

                session.commit()
                print("Order Transaction committed.")
        except Exception as e:
            # roll back
            session.rollback()
            print(f"Order Transaction rolled back due to an error: {e}")
        finally:
            # close session
            session.close()


order = CRUDOrder(Order)
