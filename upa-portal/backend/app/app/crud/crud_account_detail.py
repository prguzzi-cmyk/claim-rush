#!/usr/bin/env python

"""CRUD operations for the cart model"""

from typing import Sequence
from uuid import UUID

from fastapi_pagination.ext.sqlalchemy import paginate
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.account_detail import AccountDetail
from app.schemas.account_detail import AccountDetailCreate, AccountDetailUpdate


class CRUDAccountDetail(CRUDBase[AccountDetail, AccountDetailCreate, AccountDetailUpdate]):
    @staticmethod
    def get_account_detail_list_by_account_id(db_session: Session, params, account_id: UUID) -> Sequence[
                                                                                                    AccountDetail] | None:
        with db_session as session:
            stmt = select(AccountDetail).order_by(AccountDetail.created_at.desc()).where(
                AccountDetail.account_id == account_id)
            return paginate(session, stmt, params=params)


account_detail = CRUDAccountDetail(AccountDetail)
