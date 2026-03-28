#!/usr/bin/env python

"""Schema for ConversationMessage"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class ConversationMessageBase(BaseModel):
    lead_id: UUID | None = Field(default=None)
    direction: str | None = Field(default=None, max_length=10)
    channel: str | None = Field(default=None, max_length=10)
    sender_type: str | None = Field(default=None, max_length=20)
    sender_id: UUID | None = Field(default=None)
    content: str | None = Field(default=None)
    metadata_json: str | None = Field(default=None)


class ConversationMessageCreate(ConversationMessageBase):
    lead_id: UUID = Field()
    direction: str = Field(max_length=10)
    channel: str = Field(max_length=10)
    sender_type: str = Field(max_length=20)
    content: str = Field()


class ConversationMessageUpdate(ConversationMessageBase):
    pass


class ConversationMessageInDB(ConversationMessageBase):
    id: UUID | None = Field(description="Message ID.")

    class Config:
        orm_mode = True


class ConversationMessage(Timestamp, ConversationMessageInDB):
    pass
