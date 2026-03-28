from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    id: UUID = Field(description="Category ID")
    name: str = Field(description="Category Name")
    parent_id: Optional[UUID] = Field(description="Category Parent ID")
    created_at: datetime = Field(description="Category Create Date And Time")
    updated_at: datetime | None = Field(description="Category Update Date And Time")

    class Config:
        orm_mode = True


class CategoryCreateRequest(BaseModel):
    name: str = Field(description="Category Name")
    parent_id: Optional[UUID] = Field(description="Category Parent ID")


class CategoryCreateResponse(CategoryBase):
    pass


class CategoryUpdateRequest(BaseModel):
    name: str = Field(description="Category Name")
    parent_id: UUID | None = Field(description="Category Parent ID")


class CategoryUpdateResponse(CategoryBase):
    pass


class CategoryDeleteResponse(CategoryBase):
    pass
