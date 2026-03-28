#!/usr/bin/env python

"""Pydantic schemas for the SkiptraceWallet module"""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class SkiptraceWalletBase(BaseModel):
    user_id: UUID = Field(description="Owner user UUID.")
    credit_balance: int = Field(default=0, description="Current credit balance.")
    credits_used: int = Field(default=0, description="Total credits used.")
    last_recharge_date: datetime.datetime | None = Field(
        default=None, description="Last recharge date."
    )


class SkiptraceWalletCreate(BaseModel):
    user_id: UUID = Field(description="Owner user UUID.")
    credit_balance: int = Field(default=0)
    credits_used: int = Field(default=0)


class SkiptraceWalletUpdate(BaseModel):
    credit_balance: int | None = Field(default=None)
    credits_used: int | None = Field(default=None)
    last_recharge_date: datetime.datetime | None = Field(default=None)


class SkiptraceWalletInDB(SkiptraceWalletBase):
    id: UUID = Field(description="Wallet UUID primary key.")

    class Config:
        orm_mode = True


class SkiptraceWallet(Timestamp, SkiptraceWalletInDB):
    ...


class SkiptraceWalletSummary(BaseModel):
    credit_balance: int = Field(description="Current credit balance.")
    credits_used_total: int = Field(description="All-time credits used.")
    credits_used_this_month: int = Field(description="Credits used this calendar month.")
    is_unlimited: bool = Field(description="True for admin users (unlimited lookups).")


class CreditPurchaseRequest(BaseModel):
    pack_size: int = Field(description="Number of credits to purchase (50, 100, 250, 1000).")


class CreditPurchaseResponse(BaseModel):
    new_balance: int = Field(description="Updated credit balance after purchase.")
    credits_added: int = Field(description="Number of credits added.")
    stripe_checkout_url: str = Field(description="Stripe checkout URL (placeholder).")


class AdminUserBilling(BaseModel):
    user_id: UUID = Field(description="User UUID.")
    user_name: str = Field(description="Display name.")
    user_email: str = Field(description="User email.")
    role: str = Field(description="User role.")
    credit_balance: int = Field(description="Current credit balance.")
    is_unlimited: bool = Field(description="True for admin users.")
    skip_traces_used: int = Field(default=0, description="Total skip traces.")
    sms_used: int = Field(default=0, description="Total SMS sent.")
    ai_voice_calls_used: int = Field(default=0, description="Total AI voice calls.")
    enrichments_used: int = Field(default=0, description="Total enrichment lookups.")
    total_credits_used: int = Field(default=0, description="All-time total credits used.")
    estimated_cost_cents: int = Field(default=0, description="Estimated total cost in cents.")
    last_activity: datetime.datetime | None = Field(default=None, description="Last transaction date.")
    last_recharge: datetime.datetime | None = Field(default=None, description="Last credit purchase date.")
    subscription_status: str = Field(default="active", description="Account status.")


class AdminBillingOverview(BaseModel):
    total_users: int = Field(description="Total users with wallets.")
    total_credits_in_circulation: int = Field(description="Sum of all credit balances.")
    total_credits_used: int = Field(description="Sum of all credits ever used.")
    total_revenue_cents: int = Field(description="Estimated total revenue in cents.")
    users: list[AdminUserBilling] = Field(description="Per-user billing details.")
