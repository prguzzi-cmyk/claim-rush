import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, UUID4


class AccountDetailCreatedRequest(BaseModel):
    account_id: UUID4 = Field(description="user id")
    amount: Decimal = Field(description="account balance / credit")
    summary: str = Field(description="summary")

    class Config:
        orm_mode = True


class AccountDetailBase(BaseModel):
    amount: Decimal | None = Field(description="account balance / credit")
    summary: str | None = Field(description="summary")
    created_at: datetime.datetime | None = Field(description="credit created datetime")

    class Config:
        orm_mode = True


class AccountDetailCreate(AccountDetailBase):
    pass


class AccountDetailUpdate(AccountDetailBase):
    pass
