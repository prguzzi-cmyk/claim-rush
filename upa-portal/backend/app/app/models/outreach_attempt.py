#!/usr/bin/env python

"""SQLAlchemy model for the outreach_attempt table"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class OutreachAttempt(TimestampMixin, Base):
    campaign_id: Mapped[UUID] = mapped_column(
        ForeignKey("outreach_campaign.id", name="fk_outreach_attempt_campaign_id", ondelete="CASCADE")
    )
    lead_id: Mapped[UUID] = mapped_column(
        ForeignKey("lead.id", name="fk_outreach_attempt_lead_id", ondelete="CASCADE")
    )
    template_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("outreach_template.id", name="fk_outreach_attempt_template_id", ondelete="SET NULL")
    )
    channel: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    recipient_phone: Mapped[str | None] = mapped_column(String(20))
    recipient_email: Mapped[str | None] = mapped_column(String(255))
    message_body: Mapped[str | None] = mapped_column(Text())
    response_text: Mapped[str | None] = mapped_column(Text())
    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_outreach_attempt_agent_id", ondelete="SET NULL")
    )
    communication_log_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("communication_log.id", name="fk_outreach_attempt_comm_log_id", ondelete="SET NULL")
    )

    campaign: Mapped["OutreachCampaign"] = relationship(
        primaryjoin="OutreachAttempt.campaign_id == OutreachCampaign.id",
        lazy="joined",
        viewonly=True,
    )
