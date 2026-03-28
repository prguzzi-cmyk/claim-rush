from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import UploadFile
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    id: UUID = Field(description="Product ID")
    name: str = Field(description="Product Name")
    category_id: UUID | None = Field(description="Category ID")
    original_price: Decimal = Field(description="Product Orignal Price")
    price: Decimal = Field(description="Product Price")
    created_at: datetime = Field(description="Product Created Date And Time")
    updated_at: datetime | None = Field(description="Product Updated Date And Time")
    product_image: str = Field(description="Product Image")
    description: str | None = Field(description="Product Description")

    class Config:
        orm_mode = True


class ProductCreatedResponse(ProductBase):
    pass


class ProductUpdatedResponse(ProductBase):
    pass


class ProductCreatedRequest(BaseModel):
    name: str | None = Field(description="Product Name")
    category_id: UUID | None = Field(description="Category ID")
    original_price: Decimal | None = Field(description="Product Orignal Price")
    price: Decimal | None = Field(description="Product Price")
    description: str | None = Field(description="Product Description")
    product_image: str | None = Field(description="Product Image")
    object_name: str | None = Field(description="object name in s3 storage")


class ProductUpdatedRequest(BaseModel):
    id: str | None = Field(description="Product Id")
    name: str | None = Field(description="Product Name")
    category_id: UUID | None = Field(description="Category ID")
    original_price: Decimal | None = Field(description="Product Orignal Price")
    price: Decimal | None = Field(description="Product Price")
    description: str | None = Field(description="Product Description")
    object_name: str | None = Field(description="object name in s3 storage")
    file: UploadFile | None = Field(description="Uploaded file")
    file_name: str | None = Field(description="Uploaded file name")
    product_image: str | None = Field(description="Product Image")


class CategoryInDB(BaseModel):
    id: UUID = Field(description="Category ID")
    name: str = Field(description="Category Name")
    parent_id: UUID | None = Field(description="Category Parent ID")
    created_at: datetime = Field(description="Category Create Date And Time")
    updated_at: datetime | None = Field(description="Category Update Date And Time")

    class Config:
        orm_mode = True


class ProductListResponse(ProductBase):
    category: CategoryInDB | None = Field(description="Category")
