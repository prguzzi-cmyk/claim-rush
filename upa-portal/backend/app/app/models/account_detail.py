#!/usr/bin/env python

"""SQLAlchemy model for the account table"""
from decimal import Decimal

import sqlalchemy
from sqlalchemy import String, Column, UUID, Numeric, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin, AuditMixin


class AccountDetail(TimestampMixin, AuditMixin, Base):
    account_id = Column(UUID, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    summary = Column(String(255), nullable=False)

