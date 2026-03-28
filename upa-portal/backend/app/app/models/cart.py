#!/usr/bin/env python

"""SQLAlchemy model for the cart table"""
from decimal import Decimal

import sqlalchemy
from sqlalchemy import String, Column, UUID, Numeric, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class Cart(TimestampMixin, AuditMixin, Base):
    product_id = Column(UUID, nullable=False)
    user_id = Column(UUID, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    product_name = Column(String(255), nullable=False)
    product_image = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r})")
