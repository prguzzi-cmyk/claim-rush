#!/usr/bin/env python

"""SQLAlchemy model for the rin_source lookup table"""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class RinSource(TimestampMixin, Base):
    code: Mapped[str] = mapped_column(String(30), unique=True)
    label: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(100), default="RIN Network")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
