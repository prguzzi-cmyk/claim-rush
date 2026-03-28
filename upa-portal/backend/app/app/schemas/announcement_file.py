#!/usr/bin/env python

"""Schema for announcement file"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.file import FileOnlyBase, FileOnlyCreate, FileOnlyInDB, FileOnlyUpdate


# Shared properties
class AnnouncementFileBase(FileOnlyBase):
    ...


# Properties to receive via API on creation
class AnnouncementFileCreate(FileOnlyCreate):
    announcement_id: UUID = Field(description="The announcement ID.")


# Properties to receive via API on update
class AnnouncementFileUpdate(FileOnlyUpdate, AnnouncementFileBase):
    ...


# Properties to return via API on announcement file fetch from DB
class AnnouncementFileInDB(FileOnlyInDB, AnnouncementFileBase):
    announcement_id: UUID | None = Field(description="The announcement ID.")


# Additional properties to return via API
class AnnouncementFile(Timestamp, Audit, AnnouncementFileInDB):
    ...
