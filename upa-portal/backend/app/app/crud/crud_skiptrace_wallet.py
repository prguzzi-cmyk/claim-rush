#!/usr/bin/env python

"""CRUD operations for the skiptrace_wallet model"""

from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from sqlalchemy.orm import joinedload

from app.crud.base import CRUDBase
from app.models.skiptrace_wallet import SkiptraceWallet
from app.models.user import User
from app.schemas.skiptrace_wallet import SkiptraceWalletCreate, SkiptraceWalletUpdate


class CRUDSkiptraceWallet(CRUDBase[SkiptraceWallet, SkiptraceWalletCreate, SkiptraceWalletUpdate]):

    @staticmethod
    def get_by_user_id(db_session: Session, user_id: UUID) -> SkiptraceWallet | None:
        with db_session as session:
            return (
                session.query(SkiptraceWallet)
                .filter(SkiptraceWallet.user_id == user_id)
                .one_or_none()
            )

    @staticmethod
    def get_or_create_for_user(db_session: Session, user_id: UUID) -> SkiptraceWallet:
        with db_session as session:
            wallet = (
                session.query(SkiptraceWallet)
                .filter(SkiptraceWallet.user_id == user_id)
                .one_or_none()
            )
            if wallet:
                return wallet

            wallet = SkiptraceWallet()
            wallet.user_id = user_id
            wallet.credit_balance = 0
            wallet.credits_used = 0
            session.add(wallet)
            session.commit()
            session.refresh(wallet)
            return wallet

    @staticmethod
    def deduct_credit(db_session: Session, wallet: SkiptraceWallet) -> SkiptraceWallet:
        with db_session as session:
            wallet.credit_balance = max(0, wallet.credit_balance - 1)
            wallet.credits_used += 1
            session.add(wallet)
            session.commit()
            session.refresh(wallet)
            return wallet

    @staticmethod
    def add_credits(
        db_session: Session, wallet: SkiptraceWallet, amount: int
    ) -> SkiptraceWallet:
        with db_session as session:
            wallet.credit_balance += amount
            wallet.last_recharge_date = datetime.now(timezone.utc)
            session.add(wallet)
            session.commit()
            session.refresh(wallet)
            return wallet


    @staticmethod
    def get_all_wallets(db_session: Session) -> Sequence[SkiptraceWallet]:
        with db_session as session:
            return (
                session.query(SkiptraceWallet)
                .options(
                    joinedload(SkiptraceWallet.user).joinedload(User.role),
                )
                .all()
            )


skiptrace_wallet = CRUDSkiptraceWallet(SkiptraceWallet)
