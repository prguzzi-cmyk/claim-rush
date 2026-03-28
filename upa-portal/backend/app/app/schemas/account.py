import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, UUID4


class AccountBase(BaseModel):
    id: UUID4 | None = Field(description="account id")
    user_id: UUID4 = Field(description="user id")
    account_balance: Decimal = Field(description="account balance / credit")
    user_name: str | None = Field(description='user name')
    email: str | None = Field(description='email')
    created_at: datetime.datetime | None = Field(description='created datetime')
    updated_at: datetime.datetime | None = Field(description='updated datetime')

    class Config:
        orm_mode = True


class AccountCreatedRequest(BaseModel):
    id: UUID4 = Field(description="account id")
    user_id: UUID4 = Field(description="user id")
    account_balance: Decimal = Field(description="account balance / credit")
    created_at: datetime.datetime | None = Field(description='created datetime')
    updated_at: datetime.datetime | None = Field(description='updated datetime')

    class Config:
        orm_mode = True


class AccountUpdatedRequest(BaseModel):
    id: UUID4 = Field(description="account id")
    account_balance: Decimal = Field(description="account balance / credit")
