#!/usr/bin/env python

"""CRUD operations for the cart model"""

from typing import Sequence, Type
from uuid import UUID

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreatedRequest, AccountUpdatedRequest, AccountBase


class CRUDAccount(CRUDBase[Account, AccountCreatedRequest, AccountUpdatedRequest]):

    @staticmethod
    def get_my_account(db_session: Session, user_id: UUID) -> Type[Account] | Account:
        with db_session as session:
            acc = session.query(Account).where(Account.user_id == user_id).one_or_none()
            if acc:
                return acc
            else:
                acc = Account()
                acc.user_id = user_id
                acc.account_balance = 0
                return acc

    @staticmethod
    def get_account_by_user_id(db_session: Session, user_id: UUID) -> Type[Account] | None:
        with db_session as session:
            return session.query(Account).filter_by(user_id=user_id).one_or_none()

    @staticmethod
    def get_account_list(db_session: Session) -> Sequence[AccountBase]:
        with db_session as session:
            query = session.query(
                Account.id,
                Account.user_id,
                Account.account_balance,
                func.concat(User.first_name, User.last_name).label('user_name'),
                User.email,
                Account.created_at,
                Account.updated_at
            ).join(User, Account.user_id == User.id)
            rows = paginate(query)
            session.close()
            return rows


account = CRUDAccount(Account)
