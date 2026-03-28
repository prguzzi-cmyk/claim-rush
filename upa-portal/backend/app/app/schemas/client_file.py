#!/usr/bin/env python

"""Schema for client file"""

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
class ClientFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class ClientFileCreate(FileOnlyCreate):
    client_id: UUID = Field(description="The client ID.")


# Properties to receive via API on update
class ClientFileUpdate(FileOnlyUpdate, ClientFileBase):
    pass


# Properties to return via API on client file fetch from DB
class ClientFileInDB(FileOnlyInDB, ClientFileBase):
    client_id: UUID | None = Field(description="The client ID.")


# Additional properties to return via API
class ClientFile(Timestamp, Audit, ClientFileInDB):
    pass


# File properties to process the file
class ClientFileProcess(FileProcess):
    client_id: UUID = Field(description="The client ID.")
