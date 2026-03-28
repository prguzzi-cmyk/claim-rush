#!/usr/bin/env python

"""SQLAlchemy model for the category table"""

from sqlalchemy import String, Column, UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class Category(TimestampMixin, AuditMixin, Base):
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID, nullable=True)
    products = relationship("Product", back_populates="category")

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, name: {self.name!r}, parent_id: {self.parent_id}, created_at: {self.created_at}, updated_at: {self.updated_at}), created_by_id: {self.created_by_id}, updated_by_id: {self.updated_by_id}")
