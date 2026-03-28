#!/usr/bin/env python

"""Schema for OutreachTemplate"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


class OutreachTemplateBase(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    channel: str | None = Field(default=None, max_length=10)
    subject: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None)
    is_active: bool | None = Field(default=True)


class OutreachTemplateCreate(OutreachTemplateBase):
    name: str = Field(max_length=200)
    channel: str = Field(max_length=10)
    body: str = Field()


class OutreachTemplateUpdate(OutreachTemplateBase):
    pass


class OutreachTemplateInDB(OutreachTemplateBase):
    id: UUID | None = Field(description="Template ID.")
    created_by_id: UUID | None = Field(default=None)

    class Config:
        orm_mode = True


class OutreachTemplate(Timestamp, OutreachTemplateInDB):
    pass


class TemplatePreviewRequest(BaseModel):
    body: str = Field(description="Template body with {{variables}}")
    channel: str = Field(default="sms", max_length=10)


class TemplatePreviewResponse(BaseModel):
    rendered: str = Field(description="Rendered template with sample data")
