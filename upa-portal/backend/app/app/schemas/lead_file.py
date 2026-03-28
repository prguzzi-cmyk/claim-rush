#!/usr/bin/env python

"""Schema for lead file"""

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
class LeadFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class LeadFileCreate(FileOnlyCreate):
    lead_id: UUID = Field(description="The lead ID.")


# Properties to receive via API on update
class LeadFileUpdate(FileOnlyUpdate, LeadFileBase):
    pass


# Properties to return via API on lead file fetch from DB
class LeadFileInDB(FileOnlyInDB, LeadFileBase):
    lead_id: UUID | None = Field(description="The lead ID.")


# Additional properties to return via API
class LeadFile(Timestamp, Audit, LeadFileInDB):
    pass


# File properties to process the file
class LeadFileProcess(FileProcess):
    lead_id: UUID = Field(description="The lead ID.")
