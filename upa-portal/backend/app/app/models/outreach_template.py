#!/usr/bin/env python

"""SQLAlchemy model for the outreach_template table"""

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class OutreachTemplate(TimestampMixin, Base):
    name: Mapped[str] = mapped_column(String(200))
    channel: Mapped[str] = mapped_column(String(10))  # sms | email | voice
    subject: Mapped[str | None] = mapped_column(String(500))  # email only
    body: Mapped[str] = mapped_column(Text())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_outreach_template_created_by_id")
    )
