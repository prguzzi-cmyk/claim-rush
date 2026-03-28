#!/usr/bin/env python

"""Schema for newsletter file"""

from uuid import UUID

from pydantic import Field

from app.schemas import Audit, Timestamp
from app.schemas.file import FileOnlyBase, FileOnlyCreate, FileOnlyInDB, FileOnlyUpdate


# Shared properties
class NewsletterFileBase(FileOnlyBase):
    ...


# Properties to receive via API on creation
class NewsletterFileCreate(FileOnlyCreate):
    newsletter_id: UUID = Field(description="The newsletter ID.")


# Properties to receive via API on update
class NewsletterFileUpdate(FileOnlyUpdate, NewsletterFileBase):
    ...


# Properties to return via API on newsletter file fetch from DB
class NewsletterFileInDB(FileOnlyInDB, NewsletterFileBase):
    newsletter_id: UUID | None = Field(description="The newsletter ID.")


# Additional properties to return via API
class NewsletterFile(Timestamp, Audit, NewsletterFileInDB):
    ...
