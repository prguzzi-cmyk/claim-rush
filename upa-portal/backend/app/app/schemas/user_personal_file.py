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
class UserPersonalFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class UserPersonalFileCreate(FileOnlyCreate):
    owner_id: UUID = Field(description="The owner ID.")
    state: str = Field(description="The state name.")
    expiration_date: str = Field(description="The expiration date.")


# Properties to receive via API on update
class UserPersonalFileUpdate(FileOnlyUpdate, UserPersonalFileBase):
    state: str | None = Field(description="The state name.")
    expiration_date: str | None = Field(description="The expiration date.")


# Properties to return via API on lead file fetch from DB
class UserPersonalFileBaseFileInDB(FileOnlyInDB, UserPersonalFileBase):
    owner_id: UUID | None = Field(description="The owner ID.")
    state: str | None = Field(description="The state name.")
    expiration_date: str | None = Field(description="The expiration date.")


# Additional properties to return via API
class UserPersonalFile(Timestamp, Audit, UserPersonalFileBaseFileInDB):
    pass


# File properties to process the file
class UserPersonalFileProcess(FileProcess):
    owner_id: UUID | None = Field(description="The owner ID.")
    state: str | None = Field(description="The state name.")
    expiration_date: str | None = Field(description="The expiration date.")
