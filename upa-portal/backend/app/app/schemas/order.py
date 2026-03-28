from decimal import Decimal

from pydantic import BaseModel, Field, UUID4
from datetime import datetime


class OrderBase(BaseModel):
    user_id: UUID4 = Field(description="user id")
    total_amount: Decimal = Field(description="order total amount")
    status: str = Field(description="order status")

    class Config:
        orm_mode = True


class OrderCreate(OrderBase):
    pass


class OrderUpdate(OrderBase):
    pass


class OrderMe(OrderBase):
    id: UUID4 = Field(description="order id")
    user_name: str = Field(description="user name")
    email: str = Field(description="user name")
    created_at: datetime = Field(description="order created time")
    updated_at: datetime | None = Field(description="order updated time")
