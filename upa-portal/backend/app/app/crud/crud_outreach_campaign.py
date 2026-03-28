#!/usr/bin/env python

"""CRUD operations for outreach campaigns"""

from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import Integer, and_, case, func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.campaign_step import CampaignStep
from app.models.outreach_attempt import OutreachAttempt
from app.models.outreach_campaign import OutreachCampaign
from app.schemas.outreach_campaign import (
    OutreachCampaignCreate,
    OutreachCampaignCreateWithSteps,
    OutreachCampaignUpdate,
)


class CRUDOutreachCampaign(CRUDBase[OutreachCampaign, OutreachCampaignCreate, OutreachCampaignUpdate]):

    def get_active_by_trigger(
        self, db_session: Session, *, trigger_on: str
    ) -> Sequence[OutreachCampaign]:
        with db_session as session:
            stmt = (
                select(OutreachCampaign)
                .where(
                    and_(
                        OutreachCampaign.trigger_on == trigger_on,
                        OutreachCampaign.is_active.is_(True),
                    )
                )
                .order_by(OutreachCampaign.created_at)
            )
            return session.scalars(stmt).all()

    def create_with_steps(
        self, db_session: Session, *, obj_in: OutreachCampaignCreateWithSteps, created_by_id: UUID | None = None
    ) -> OutreachCampaign:
        """Create campaign + nested CampaignStep rows."""
        with db_session as session:
            steps_data = obj_in.steps
            campaign_data = jsonable_encoder(obj_in, exclude={"steps"})
            if created_by_id:
                campaign_data["created_by_id"] = str(created_by_id)

            db_obj = OutreachCampaign(**campaign_data)
            session.add(db_obj)
            session.flush()

            for step in steps_data:
                step_obj = CampaignStep(
                    campaign_id=db_obj.id,
                    step_number=step.step_number,
                    channel=step.channel,
                    template_id=step.template_id,
                    delay_minutes=step.delay_minutes,
                    subject=step.subject,
                )
                session.add(step_obj)

            session.commit()
            session.refresh(db_obj)
            return db_obj

    def preview_targeted_leads(
        self,
        db_session: Session,
        *,
        incident_type: str | None = None,
        target_zip_code: str | None = None,
        target_radius_miles: int | None = None,
        lead_source: str | None = None,
        territory_state: str | None = None,
    ) -> dict:
        """Query leads matching targeting criteria. Returns count + sample list."""
        from app.models.lead import Lead
        from app.models.lead_contact import LeadContact

        with db_session as session:
            stmt = (
                select(Lead, LeadContact)
                .outerjoin(LeadContact, Lead.id == LeadContact.lead_id)
            )

            filters = []

            if incident_type:
                filters.append(Lead.peril == incident_type)

            if lead_source:
                filters.append(Lead.source == lead_source)

            if territory_state:
                filters.append(LeadContact.state == territory_state)

            if target_zip_code:
                if target_radius_miles and target_radius_miles > 0:
                    # Approximate by zip prefix: 3-digit prefix for ~25mi, first digits for broader
                    if target_radius_miles <= 10:
                        prefix_len = 4
                    elif target_radius_miles <= 25:
                        prefix_len = 3
                    elif target_radius_miles <= 50:
                        prefix_len = 2
                    else:
                        prefix_len = 1
                    zip_prefix = target_zip_code[:prefix_len]
                    filters.append(LeadContact.zip_code.like(f"{zip_prefix}%"))
                else:
                    filters.append(LeadContact.zip_code == target_zip_code)

            if filters:
                stmt = stmt.where(and_(*filters))

            stmt = stmt.order_by(Lead.created_at.desc())
            results = session.execute(stmt).all()

            total = len(results)
            sample = []
            for lead, contact in results[:10]:
                sample.append({
                    "id": str(lead.id),
                    "name": contact.full_name if contact else "Unknown",
                    "address": f"{contact.address or ''}, {contact.city or ''} {contact.state or ''}" if contact else "",
                    "zip": contact.zip_code if contact else "",
                    "peril": lead.peril,
                })

            return {"total_leads": total, "sample_leads": sample}

    def launch_campaign(self, db_session: Session, *, campaign_id: UUID) -> OutreachCampaign:
        """Set status='active', launched_at=now, dispatch Celery task."""
        with db_session as session:
            campaign = session.get(OutreachCampaign, campaign_id)
            if not campaign:
                return None
            campaign.status = "active"
            campaign.launched_at = datetime.now(timezone.utc)
            session.add(campaign)
            session.commit()
            session.refresh(campaign)

            # Dispatch Celery task
            from app.tasks.campaign_manager import execute_campaign
            execute_campaign.delay(str(campaign_id))

            return campaign

    def pause_campaign(self, db_session: Session, *, campaign_id: UUID) -> OutreachCampaign:
        """Set status='paused'."""
        with db_session as session:
            campaign = session.get(OutreachCampaign, campaign_id)
            if not campaign:
                return None
            campaign.status = "paused"
            session.add(campaign)
            session.commit()
            session.refresh(campaign)
            return campaign

    def get_dashboard_metrics(self, db_session: Session) -> dict:
        """Aggregate stats across active campaigns + by-channel breakdown."""
        with db_session as session:
            # Active campaigns count
            active_count = session.scalar(
                select(func.count()).where(OutreachCampaign.status == "active")
            ) or 0

            # Totals from campaign stats
            totals = session.execute(
                select(
                    func.sum(OutreachCampaign.total_targeted),
                    func.sum(OutreachCampaign.total_sent),
                    func.sum(OutreachCampaign.total_delivered),
                    func.sum(OutreachCampaign.total_responded),
                ).where(OutreachCampaign.status.in_(["active", "completed"]))
            ).one()

            total_targeted = totals[0] or 0
            total_sent = totals[1] or 0
            total_delivered = totals[2] or 0
            total_responded = totals[3] or 0

            contact_rate = (total_delivered / total_sent * 100) if total_sent > 0 else 0.0
            response_rate = (total_responded / total_sent * 100) if total_sent > 0 else 0.0

            # By-channel breakdown from OutreachAttempt
            channel_stats = session.execute(
                select(
                    OutreachAttempt.channel,
                    func.count().label("sent"),
                    func.sum(case((OutreachAttempt.status == "delivered", 1), else_=0)).label("delivered"),
                    func.sum(case((OutreachAttempt.status == "responded", 1), else_=0)).label("responded"),
                ).group_by(OutreachAttempt.channel)
            ).all()

            by_channel = {}
            for row in channel_stats:
                by_channel[row.channel] = {
                    "sent": row.sent or 0,
                    "delivered": row.delivered or 0,
                    "responded": row.responded or 0,
                }

            # By-campaign breakdown
            campaigns = session.execute(
                select(
                    OutreachCampaign.name,
                    OutreachCampaign.campaign_type,
                    OutreachCampaign.total_targeted,
                    OutreachCampaign.total_sent,
                    OutreachCampaign.total_delivered,
                    OutreachCampaign.total_responded,
                ).where(OutreachCampaign.status.in_(["active", "completed"]))
                .order_by(OutreachCampaign.created_at.desc())
                .limit(20)
            ).all()

            by_campaign = [
                {
                    "name": c[0],
                    "type": c[1],
                    "targeted": c[2] or 0,
                    "sent": c[3] or 0,
                    "delivered": c[4] or 0,
                    "responded": c[5] or 0,
                }
                for c in campaigns
            ]

            return {
                "active_campaigns": active_count,
                "total_leads_targeted": total_targeted,
                "total_contact_attempts": total_sent,
                "overall_contact_rate": round(contact_rate, 1),
                "overall_response_rate": round(response_rate, 1),
                "by_channel": by_channel,
                "by_campaign": by_campaign,
            }


outreach_campaign = CRUDOutreachCampaign(OutreachCampaign)
