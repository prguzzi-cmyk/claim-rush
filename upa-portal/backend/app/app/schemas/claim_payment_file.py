#!/usr/bin/env python

"""Schema for claim payment file"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.file import (
    FileOnlyBase,
    FileOnlyCreate,
    FileOnlyInDB,
    FileOnlyUpdate,
    FileProcess,
)


# Shared properties
class ClaimPaymentFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class ClaimPaymentFileCreate(FileOnlyCreate):
    payment_id: UUID = Field(description="The payment ID.")


# Properties to receive via API on update
class ClaimPaymentFileUpdate(FileOnlyUpdate):
    pass


# Properties to return via API on claim file fetch from DB
class ClaimPaymentFileInDB(FileOnlyInDB, ClaimPaymentFileBase):
    payment_id: UUID | None = Field(description="The payment ID.")


# Additional properties to return via API
class ClaimPaymentFile(Timestamp, Audit, ClaimPaymentFileInDB):
    pass


# File properties to process the file
class ClaimPaymentFileProcess(FileProcess):
    payment_id: UUID = Field(description="The payment ID.")
