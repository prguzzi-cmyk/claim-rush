#!/usr/bin/env python

"""CRUD operations for the Claim Payment model"""

from typing import Any, Sequence

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import ClaimPayment
from app.schemas import ClaimPaymentCreateDB, ClaimPaymentUpdate


class CRUDClaimPayment(
    CRUDBase[ClaimPayment, ClaimPaymentCreateDB, ClaimPaymentUpdate]
):
    def get_sum(
        self,
        db_session: Session,
        filters: list = None,
        claim_payments: list[ClaimPayment] | None = None,
    ) -> Sequence[Any]:
        """
        Get a sum of payments group by payment type.

        Parameters
        ----------
        db_session : Session
            Database session
        filters : list
            A list consists of filters
        claim_payments : list[ClaimPayment] | None
            A list of claim payments

        Returns
        -------
        Sequence[Any]
            Returns a list of payments sum group by payment types.
        """
        if not claim_payments:
            claim_payments: Sequence[ClaimPayment] = self.get_multi(
                db_session, filters=filters, paginated=False
            )

        settlement = 0
        total_fees = 0
        contingency_fee = 0
        client_amount = 0
        for payment in claim_payments:
            payment_fees = self.calculate_fees(payment)
            settlement += payment.check_amount
            contingency_fee += payment_fees[0]
            total_fees += payment_fees[1]
            client_amount += payment_fees[2]

        return [
            {
                "payment_type": "settlement",
                "total_amount": settlement,
            },
            {
                "payment_type": "contingency_fee",
                "total_amount": contingency_fee,
            },
            {
                "payment_type": "total_fees",
                "total_amount": total_fees,
            },
            {
                "payment_type": "client_amount",
                "total_amount": client_amount,
            },
        ]

    @staticmethod
    def calculate_fees(payment):
        contingency_fee = payment.check_amount * (
            payment.contingency_fee_percentage / 100
        )
        total_fees = round(
            (
                contingency_fee
                + (payment.appraisal_fee or 0)
                + (payment.umpire_fee or 0)
                + (payment.mold_fee or 0)
                + (payment.misc_fee or 0)
            ),
            2,
        )
        client_amount = round((payment.check_amount - total_fees), 2)

        return contingency_fee, total_fees, client_amount


claim_payment = CRUDClaimPayment(ClaimPayment)
