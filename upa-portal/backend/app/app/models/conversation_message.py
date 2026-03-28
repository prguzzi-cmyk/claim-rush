#!/usr/bin/env python

"""SQLAlchemy model for the conversation_message table"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class ConversationMessage(TimestampMixin, Base):
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_conversation_message_lead_id", ondelete="CASCADE")
    )
    direction: Mapped[str] = mapped_column(String(10))  # inbound | outbound
    channel: Mapped[str] = mapped_column(String(10))  # sms | email | voice | in_app
    sender_type: Mapped[str] = mapped_column(String(20))  # agent | system | homeowner
    sender_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_conversation_message_sender_id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text())
    metadata_json: Mapped[str | None] = mapped_column(Text())
