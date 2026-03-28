#!/usr/bin/env python

"""Schema for claim file"""

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
class ClaimFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class ClaimFileCreate(FileOnlyCreate):
    claim_id: UUID = Field(description="The claim ID.")


# Properties to receive via API on update
class ClaimFileUpdate(FileOnlyUpdate, ClaimFileBase):
    pass


# Properties to return via API on claim file fetch from DB
class ClaimFileInDB(FileOnlyInDB, ClaimFileBase):
    claim_id: UUID | None = Field(description="The claim ID.")


# Additional properties to return via API
class ClaimFile(Timestamp, Audit, ClaimFileInDB):
    pass


# File properties to process the file
class ClaimFileProcess(FileProcess):
    claim_id: UUID = Field(description="The claim ID.")
