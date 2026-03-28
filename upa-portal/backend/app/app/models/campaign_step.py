#!/usr/bin/env python

"""SQLAlchemy model for the campaign_step table"""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin


class CampaignStep(TimestampMixin, Base):
    campaign_id: Mapped[UUID] = mapped_column(
        ForeignKey("outreach_campaign.id", name="fk_campaign_step_campaign_id", ondelete="CASCADE")
    )
    step_number: Mapped[int] = mapped_column(Integer)
    channel: Mapped[str] = mapped_column(String(10))  # voice | sms | email
    template_id: Mapped[UUID] = mapped_column(
        ForeignKey("outreach_template.id", name="fk_campaign_step_template_id", ondelete="RESTRICT")
    )
    delay_minutes: Mapped[int] = mapped_column(Integer, default=0)  # delay from previous step
    subject: Mapped[str | None] = mapped_column(String(200))  # email subject override

    campaign: Mapped["OutreachCampaign"] = relationship(back_populates="steps")
    template: Mapped["OutreachTemplate"] = relationship(lazy="joined", viewonly=True)
