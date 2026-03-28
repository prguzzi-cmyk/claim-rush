#!/usr/bin/env python

"""CRUD operations for the skiptrace_transaction model"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.skiptrace_transaction import SkiptraceTransaction
from app.schemas.skiptrace_transaction import (
    SkiptraceTransactionCreate,
    SkiptraceTransactionUpdate,
)


class CRUDSkiptraceTransaction(
    CRUDBase[SkiptraceTransaction, SkiptraceTransactionCreate, SkiptraceTransactionUpdate]
):

    @staticmethod
    def get_by_wallet_id(
        db_session: Session, wallet_id: UUID
    ) -> Sequence[SkiptraceTransaction]:
        with db_session as session:
            return (
                session.query(SkiptraceTransaction)
                .filter(SkiptraceTransaction.wallet_id == wallet_id)
                .order_by(SkiptraceTransaction.created_at.desc())
                .all()
            )

    @staticmethod
    def get_by_lead_id(
        db_session: Session, lead_id: UUID
    ) -> Sequence[SkiptraceTransaction]:
        with db_session as session:
            return (
                session.query(SkiptraceTransaction)
                .filter(SkiptraceTransaction.lead_id == lead_id)
                .order_by(SkiptraceTransaction.created_at.desc())
                .all()
            )

    @staticmethod
    def get_credits_used_this_month(
        db_session: Session, wallet_id: UUID, year: int, month: int
    ) -> int:
        with db_session as session:
            result = (
                session.query(func.coalesce(func.sum(SkiptraceTransaction.credits_used), 0))
                .filter(
                    SkiptraceTransaction.wallet_id == wallet_id,
                    extract("year", SkiptraceTransaction.created_at) == year,
                    extract("month", SkiptraceTransaction.created_at) == month,
                )
                .scalar()
            )
            return int(result)


    @staticmethod
    def get_usage_by_action_type(
        db_session: Session, wallet_id: UUID
    ) -> dict[str, int]:
        """Return {action_type: total_credits_used} for a wallet."""
        with db_session as session:
            rows = (
                session.query(
                    SkiptraceTransaction.action_type,
                    func.coalesce(func.sum(SkiptraceTransaction.credits_used), 0),
                )
                .filter(SkiptraceTransaction.wallet_id == wallet_id)
                .group_by(SkiptraceTransaction.action_type)
                .all()
            )
            return {row[0] or "skip_trace": int(row[1]) for row in rows}

    @staticmethod
    def get_last_activity(
        db_session: Session, wallet_id: UUID
    ) -> "datetime | None":
        """Return the most recent transaction date for a wallet."""
        from datetime import datetime

        with db_session as session:
            result = (
                session.query(func.max(SkiptraceTransaction.created_at))
                .filter(SkiptraceTransaction.wallet_id == wallet_id)
                .scalar()
            )
            return result


skiptrace_transaction = CRUDSkiptraceTransaction(SkiptraceTransaction)
