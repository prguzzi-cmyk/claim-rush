#!/usr/bin/env python

"""Schema for File"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Audit, FileTags, FileTagsCreate, FileTagsUpdate, Timestamp


# Shared properties
class FileOnly(BaseModel):
    name: str | None = Field(default=None, max_length=255, description="File name.")
    description: str | None = Field(default=None, description="File description.")
    visibility: str | None = Field(default="internal", description="File visibility: internal or shared.")

    can_be_removed: bool | None = Field(
        default=True, description="Is the file can be removed?"
    )


# Shared properties
class FileOnlyBase(FileOnly):
    slugged_name: str | None = Field(
        default=None, max_length=255, description="Slugged file name."
    )


# File properties to process the file
class FileProcess(FileOnlyBase):
    name: str = Field(max_length=255, description="File name.")
    content: bytes = Field(description="File content.")
    type: str = Field(description="File type.")
    size: int = Field(description="File size in bytes.")


class FileBase(FileTags, FileOnlyBase):
    pass


# Properties to receive via API on creation
class FileOnlyCreate(FileOnlyBase):
    name: str = Field(max_length=255, description="File name.")
    type: str = Field(description="File type.")
    size: int = Field(description="File size in bytes.")
    path: str = Field(description="File path.")
    description: str | None = Field(default=None, description="File description.")


class FileCreate(FileTagsCreate, FileOnlyCreate, FileBase):
    pass


# Properties to receive via API on update
class FileOnlyUpdate(FileOnly):
    name: str | None = Field(max_length=255, description="File name.")
    can_be_removed: bool | None = Field(description="Is the file can be removed?")


class FileUpdate(FileTagsUpdate, FileOnlyUpdate, FileBase):
    pass


# Properties to return via API on file fetch from DB
class FileOnlyInDB(FileOnlyBase):
    name: str | None = Field(description="File name.")
    slugged_name: str | None = Field(description="Slugged file name.")
    type: str | None = Field(description="File type.")
    size: int | None = Field(description="File size in bytes.")
    path: str | None = Field(description="File path.")

    id: UUID | None = Field(description="Id of a file.")

    can_be_removed: bool | None = Field(description="Is the file can be removed?")

    class Config:
        orm_mode = True


class FileInDB(FileOnlyInDB, FileBase):
    pass


# Additional properties to return via API
class File(Timestamp, Audit, FileInDB):
    pass
