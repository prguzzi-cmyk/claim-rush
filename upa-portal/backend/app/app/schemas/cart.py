from decimal import Decimal

from pydantic import BaseModel, Field, UUID4


class CartCreatedRequest(BaseModel):
    product_id: str = Field(description="product id")
    user_id: UUID4 | None = Field(description="user id")
    product_name: str = Field(description="product name")
    product_image: str = Field(description="product image")
    quantity: int = Field(description="product quantity")
    price: Decimal = Field(description="product price")


class CartUpdatedRequest(BaseModel):
    id: UUID4 = Field(description="cart item id")
    quantity: int = Field(description="cart item quantity")


class CartBase(BaseModel):
    id: UUID4 | None = Field(description="cart id")
    product_id: UUID4 | None = Field(description="product id")
    product_name: str | None = Field(description="product name")
    product_image: str | None = Field(description="product image")
    quantity: int | None = Field(description="product quantity")
    price: Decimal | None = Field(description="product price")

    class Config:
        orm_mode = True
