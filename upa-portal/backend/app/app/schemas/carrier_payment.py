#!/usr/bin/env python

"""Pydantic schemas for the CarrierPayment module"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, Timestamp


class CarrierPaymentBase(BaseModel):
    payment_amount: float = Field(description="Payment amount in dollars.")
    payment_date: date = Field(description="Date payment was received.")
    payment_type: str = Field(max_length=50, description="Payment type (e.g. ACV, RCV, Supplement).")
    note: str | None = Field(default=None, description="Optional note about this payment.")


class CarrierPaymentCreate(CarrierPaymentBase):
    pass


class CarrierPaymentCreateDB(CarrierPaymentBase):
    project_id: UUID = Field(description="Parent estimate project UUID.")


class CarrierPaymentUpdate(BaseModel):
    payment_amount: float | None = Field(default=None, description="Payment amount.")
    payment_date: date | None = Field(default=None, description="Payment date.")
    payment_type: str | None = Field(default=None, max_length=50, description="Payment type.")
    note: str | None = Field(default=None, description="Note.")


class CarrierPaymentInDB(CarrierPaymentBase):
    id: UUID | None = Field(description="Payment UUID.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")

    class Config:
        orm_mode = True


class CarrierPayment(Timestamp, Audit, CarrierPaymentInDB):
    ...
