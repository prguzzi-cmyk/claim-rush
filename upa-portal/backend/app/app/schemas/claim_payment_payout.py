#!/usr/bin/env python

"""Schema for Claim Payment Payout"""

from app.schemas import ClaimPaymentInDB, ClaimPayout, ClientMinimal, ClaimPaymentsSum


class ClaimPaymentPayout(ClaimPaymentsSum):
    claim: ClaimPayout
    client: ClientMinimal
    payments: list[ClaimPaymentInDB]
