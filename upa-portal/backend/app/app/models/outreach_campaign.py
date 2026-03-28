#!/usr/bin/env python

"""SQLAlchemy model for the outreach_campaign table"""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.campaign_step import CampaignStep


class OutreachCampaign(TimestampMixin, Base):
    name: Mapped[str] = mapped_column(String(200))
    lead_source: Mapped[str | None] = mapped_column(String(30))  # fire | storm | hail | rotation | null=all
    territory_state: Mapped[str | None] = mapped_column(String(2))  # 2-letter state filter
    contact_method: Mapped[str] = mapped_column(String(10))  # voice | sms | email
    template_id: Mapped[UUID] = mapped_column(
        ForeignKey("outreach_template.id", name="fk_outreach_campaign_template_id", ondelete="RESTRICT")
    )
    delay_minutes: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    trigger_on: Mapped[str] = mapped_column(String(30))  # new_lead | skip_trace_complete | agent_assigned
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user.id", name="fk_outreach_campaign_created_by_id")
    )

    # Campaign Manager fields
    description: Mapped[str | None] = mapped_column(String(500))
    campaign_type: Mapped[str] = mapped_column(String(20), default="sms")  # ai_voice | sms | email | multi_step
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | active | paused | completed | archived
    incident_type: Mapped[str | None] = mapped_column(String(50))  # fire | storm | hail | wind | null=all
    target_zip_code: Mapped[str | None] = mapped_column(String(10))  # center zip for radius search
    target_radius_miles: Mapped[int | None] = mapped_column(Integer)  # radius in miles from target_zip

    # Stats counters (denormalized for fast dashboard reads)
    total_targeted: Mapped[int] = mapped_column(Integer, default=0)
    total_sent: Mapped[int] = mapped_column(Integer, default=0)
    total_delivered: Mapped[int] = mapped_column(Integer, default=0)
    total_responded: Mapped[int] = mapped_column(Integer, default=0)
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    template: Mapped["OutreachTemplate"] = relationship(
        primaryjoin="OutreachCampaign.template_id == OutreachTemplate.id",
        lazy="joined",
        viewonly=True,
    )

    steps: Mapped[list["CampaignStep"]] = relationship(
        back_populates="campaign",
        order_by="CampaignStep.step_number",
        cascade="all, delete-orphan",
    )
