#!/usr/bin/env python

"""Schema for template file"""

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
class TemplateFileBase(FileOnlyBase):
    pass


# Properties to receive via API on creation
class TemplateFileCreate(FileOnlyCreate):
    state: str = Field(description="The State abbreviation.")


# Properties to receive via API on update
class TemplateFileUpdate(FileOnlyUpdate, TemplateFileBase):
    type: str | None = Field(description="File type.")
    size: int | None = Field(description="File size in bytes.")
    path: str | None = Field(description="File path.")
    state: str | None = Field(description="The State abbreviation.")


# Properties to return via API on template file fetch from DB
class TemplateFileInDB(FileOnlyInDB, TemplateFileBase):
    state: str | None = Field(description="The State abbreviation.")


# Additional properties to return via API
class TemplateFile(Timestamp, Audit, TemplateFileInDB):
    pass


# File properties to process the file
class TemplateFileProcess(FileProcess):
    state: str = Field(description="The United State abbreviation.")


# Optional File properties to process the file
class TemplateFileProcessOptional(FileOnlyBase):
    content: bytes | None = Field(description="File content.")
    type: str | None = Field(description="File type.")
    size: int | None = Field(description="File size in bytes.")
    state: str | None = Field(description="The State abbreviation.")
