#!/usr/bin/env python

"""Schema for File Tags'"""

from uuid import UUID

from pydantic import BaseModel, Field


class FileTagBase(BaseModel):
    id: UUID | None = Field(description="Id of a tag.")

    class Config:
        orm_mode = True


class FileTagCreate(FileTagBase):
    id: UUID = Field(description="Id of a tag.")


class FileTagUpdate(FileTagBase):
    id: UUID = Field(description="Id of a tag.")


class FileTag(FileTagBase):
    name: str | None = Field(description="Tag name.")
    slug: str | None = Field(description="Tag slug.")


class FileTags(BaseModel):
    tags: list[FileTag] | None = Field(
        default=None, description="A list consist of tags UUID."
    )


class FileTagsCreate(FileTags):
    tags: list[str] | None = Field(
        default=None, min_items=1, description="A list consist of tags UUID."
    )


class FileTagsUpdate(FileTags):
    tags: list[FileTagUpdate] | None = Field(
        default=None,
        min_items=1,
        description="A list consist of tags UUID. \n\n"
        "_If provided, then must have existing attached tags UUID "
        "because the system will delete all attached existing tag records._",
    )


class FileTagsAppend(FileTags):
    tags: list[FileTagCreate] = Field(
        min_items=1, description="A list consist of tags UUID."
    )


class FileTagsRemove(FileTags):
    tags: list[FileTagCreate] = Field(
        min_items=1, description="A list consist of tags UUID."
    )
