#!/usr/bin/env python

"""Schema for Tag Association'"""

from uuid import UUID

from pydantic import BaseModel, Field


class TagAssocBase(BaseModel):
    id: UUID | None = Field(description="Id of a tag.")

    class Config:
        orm_mode = True


class TagAssocCreate(TagAssocBase):
    id: UUID = Field(description="Id of a tag.")


class TagAssocUpdate(TagAssocBase):
    id: UUID = Field(description="Id of a tag.")


class TagAssoc(TagAssocBase):
    name: str | None = Field(description="Tag name.")
    slug: str | None = Field(description="Tag slug.")


class Tags(BaseModel):
    tags: list[TagAssoc] | None = Field(
        default=None, description="A list consist of tags UUID."
    )


class TagsCreate(Tags):
    tags: list[str] | None = Field(
        default=None, min_items=1, description="A list consist of tags UUID."
    )


class TagsUpdate(Tags):
    tags: list[TagAssocUpdate] | None = Field(
        default=None,
        min_items=1,
        description="A list consist of tags UUID. \n\n"
        "_If provided, then must have existing attached tags UUID "
        "because the system will delete all attached existing tag records._",
    )


class TagsAppend(Tags):
    tags: list[TagAssocCreate] = Field(
        min_items=1, description="A list consist of tags UUID."
    )


class TagsRemove(Tags):
    tags: list[TagAssocCreate] = Field(
        min_items=1, description="A list consist of tags UUID."
    )
