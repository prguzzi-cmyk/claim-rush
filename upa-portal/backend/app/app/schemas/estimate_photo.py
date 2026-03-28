#!/usr/bin/env python

"""Pydantic schemas for the EstimatePhoto module"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas import Timestamp


# Shared properties
class EstimatePhotoBase(BaseModel):
    image_url: str | None = Field(default=None, max_length=500, description="Photo URL.")
    caption: str | None = Field(default=None, max_length=200, description="Photo caption.")
    ai_tags: str | None = Field(default=None, description="AI-generated tags (JSON).")
    photo_type: str | None = Field(default=None, max_length=20, description="Photo type.")


# Properties required when creating
class EstimatePhotoCreate(EstimatePhotoBase):
    image_url: str = Field(max_length=500, description="Photo URL.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")
    room_id: UUID | None = Field(default=None, description="Associated room UUID.")


# Properties accepted on update
class EstimatePhotoUpdate(EstimatePhotoBase):
    pass


# Properties returned from DB
class EstimatePhotoInDB(EstimatePhotoBase):
    id: UUID | None = Field(description="Photo UUID.")
    project_id: UUID | None = Field(default=None, description="Parent project UUID.")
    room_id: UUID | None = Field(default=None, description="Associated room UUID.")

    class Config:
        orm_mode = True


# Full response schema
class EstimatePhoto(Timestamp, EstimatePhotoInDB):
    ...
