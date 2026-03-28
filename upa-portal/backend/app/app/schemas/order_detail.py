from decimal import Decimal

from pydantic import BaseModel, Field, UUID4


class OrderDetailBase(BaseModel):
    id: UUID4 = Field(description="order detail id")
    order_id: UUID4 = Field(description="order id")
    product_name: str = Field(description="product name")
    product_image: str = Field(description="product image")
    price: Decimal = Field(description="price")
    quantity: int = Field(description="quantity")

    class Config:
        orm_mode = True


class OrderDetailCreate(BaseModel):
    pass


class OrderDetailUpdate(BaseModel):
    pass
