#!/usr/bin/env python

"""Claim Payment Repository"""

from datetime import date, timedelta
from typing import Sequence
from uuid import UUID

from fastapi_pagination import Page, paginate
from fastapi_pagination.utils import disable_installed_extensions_check
from sqlalchemy import and_, select, or_, update
from sqlalchemy.orm import Session

from app import crud
from app.core.enums import ClaimPaymentCheckTypes
from app.core.log import logger
from app.models import ClaimPayment, Claim
from app.utils.exceptions import exc_conflict


class ClaimPaymentRepository:
    def __init__(self, db_session: Session):
        """
        Initialize the ClaimPaymentRepository with the given database session.

        Parameters
        ----------
        db_session : Session
            The database session used for accessing claim payment data.
        """
        self.db_session = db_session

    def get_claim_payments_ready_to_process(
        self,
        until_date: date,
        paginated: bool = True,
    ) -> Page | Sequence[ClaimPayment]:
        """
        Fetch claim payments that are ready to be processed until the specified date.

        Parameters
        ----------
        until_date : date
            The date until which claim payments are to be fetched.
        paginated : bool
            If `True` result set will be paginated.

        Returns
        -------
        Page | Sequence[ClaimPayment]
            An iterable consist of claim payments and other related data.
        """
        today = date.today()
        start_of_current_week = today - timedelta(days=today.weekday())

        standard_check_condition = and_(
            ClaimPayment.check_type == ClaimPaymentCheckTypes.STANDARD.value,
            ClaimPayment.payment_date < start_of_current_week,
            ClaimPayment.payment_date <= until_date,
            ClaimPayment.is_locked.is_(False),
        )

        flagged_check_condition = and_(
            ClaimPayment.check_type == ClaimPaymentCheckTypes.FLAGGED.value,
            ClaimPayment.is_ready_to_process.is_(True),
            ClaimPayment.payment_date <= until_date,
            ClaimPayment.is_locked.is_(False),
        )

        with self.db_session as session:
            try:
                stmt = (
                    select(ClaimPayment)
                    .join(ClaimPayment.claim)
                    .join(Claim.client)
                    .filter(or_(standard_check_condition, flagged_check_condition))
                )

                claim_payments = session.scalars(stmt).unique().all()

                claim_payment_payouts = {}
                for payment in claim_payments:
                    if payment.claim.id not in claim_payment_payouts:
                        claim_payment_payouts[payment.claim.id] = {
                            "claim": payment.claim,
                            "client": payment.claim.client,
                            "payments": [],
                            "payments_sum": [],
                        }
                    claim_payment_payouts[payment.claim.id]["payments"].append(payment)

                for claim_payment_payout in claim_payment_payouts.values():
                    # Get a total of payments by their type
                    total = crud.claim_payment.get_sum(
                        self.db_session, claim_payments=claim_payment_payout["payments"]
                    )

                    if total:
                        claim_payment_payout["payments_sum"] = total

                if paginated:
                    disable_installed_extensions_check()
                    return paginate(list(claim_payment_payouts.values()))

                return claim_payment_payouts
            except Exception as e:
                logger.error(str(e))
                exc_conflict("There is some issue. Please try again later.")

    def lock_payments(self, payment_ids: list[UUID]) -> None:
        """
        Lock the claim payments with the given IDs.

        Parameters
        ----------
        payment_ids : list[UUID]
            A list of payment IDs to be locked.
        """
        self.db_session.execute(
            update(ClaimPayment)
            .where(ClaimPayment.id.in_(payment_ids))
            .values(is_locked=True)
        )

        self.db_session.commit()
