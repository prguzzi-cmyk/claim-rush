#!/usr/bin/env python

"""SQLAlchemy model for the account table"""
from decimal import Decimal

import sqlalchemy
from sqlalchemy import String, Column, UUID, Numeric, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class Account(TimestampMixin, AuditMixin, Base):
    user_id = Column(UUID, nullable=False)
    account_balance = Column(Numeric(10, 2), nullable=False)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(id={self.id!r}, user_id={self.user_id}, account_balance={self.account_balance})")
