#!/usr/bin/env python

"""Claim Payment Service"""

from datetime import date
from typing import Sequence
from uuid import UUID

from fastapi_pagination import Page

from app.models import ClaimPayment
from app.repositories import ClaimPaymentRepository


class ClaimPaymentService:
    def __init__(self, repository: ClaimPaymentRepository):
        """
        Initialize the ClaimPaymentService with the given repository.

        Parameters
        ----------
        repository : ClaimPaymentRepository
            The repository used for accessing claim payment data.
        """
        self.repository = repository

    def fetch_claim_payments_ready_to_process(
        self, until_date: date
    ) -> Page | Sequence[ClaimPayment]:
        """
        Fetch claim payments that are ready to be processed until the specified date.

        Parameters
        ----------
        until_date : date
            The date until which claim payments are to be fetched.

        Returns
        -------
        Page | Sequence[ClaimPayment]
            An iterable consist of claim payments and other related data.
        """
        return self.repository.get_claim_payments_ready_to_process(until_date)

    def lock_payments(self, payment_ids: list[UUID]) -> None:
        """
        Lock the claim payments with the given IDs.

        Parameters
        ----------
        payment_ids : list[UUID]
            A list of payment IDs to be locked.
        """
        self.repository.lock_payments(payment_ids)
