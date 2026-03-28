#!/usr/bin/env python

"""SQLAlchemy model for the product table"""
from decimal import Decimal

from sqlalchemy import String, Column, UUID, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class Product(TimestampMixin, AuditMixin, Base):
    name = Column(String(255), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('category.id', name="fk_cateogry_id"), nullable=True)
    original_price = Column(Numeric(10, 2), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    description = Column(Text)
    product_image = Column(String(255))
    category = relationship("Category", back_populates="products")
    object_name = Column(String(255), nullable=True)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, name: {self.name!r}, category_id: {self.category_id}, original_price: {self.original_price}, price: {self.price}), created_at: {self.created_at}, updated_at: {self.updated_at}), created_by_id: {self.created_by_id}, updated_by_id: {self.updated_by_id}")
