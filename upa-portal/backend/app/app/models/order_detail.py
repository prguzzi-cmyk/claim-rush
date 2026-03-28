#!/usr/bin/env python

"""SQLAlchemy model for the cart table"""
from datetime import datetime

import sqlalchemy
from sqlalchemy import String, Column, UUID, Numeric, Text, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class OrderDetail(TimestampMixin, AuditMixin, Base):
    order_id = Column(UUID, nullable=False)
    product_id = Column(UUID, nullable=False)
    product_name = Column(String(255), nullable=False)
    product_image = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
