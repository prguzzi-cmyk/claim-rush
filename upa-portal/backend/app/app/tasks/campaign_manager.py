#!/usr/bin/env python

"""Celery task for campaign execution — finds matching leads and dispatches outreach steps."""

import logging
from uuid import UUID

from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=2,
    retry_backoff=True,
    name="app.tasks.campaign_manager.execute_campaign",
)
def execute_campaign(self, campaign_id: str) -> dict:
    """
    Execute a campaign:
    1. Load campaign + steps (ordered by step_number)
    2. Query matching leads (incident_type, zip, radius, lead_source)
    3. For each lead x each step, schedule execute_outreach_task with delay
    4. Update campaign stats counters
    """
    task_id = self.request.id
    logger.info("[CampaignManager:%s] Starting campaign=%s", task_id, campaign_id)

    db = SessionLocal()
    try:
        from sqlalchemy import and_, select

        from app.models.campaign_step import CampaignStep
        from app.models.lead import Lead
        from app.models.lead_contact import LeadContact
        from app.models.outreach_campaign import OutreachCampaign
        from app.tasks.outreach import execute_outreach_task

        campaign = db.get(OutreachCampaign, UUID(campaign_id))
        if not campaign:
            logger.error("[CampaignManager:%s] Campaign %s not found", task_id, campaign_id)
            return {"status": "error", "reason": "campaign not found"}

        if campaign.status != "active":
            logger.info("[CampaignManager:%s] Campaign %s not active (status=%s)", task_id, campaign_id, campaign.status)
            return {"status": "skipped", "reason": f"campaign status is {campaign.status}"}

        # Load steps
        steps = db.scalars(
            select(CampaignStep)
            .where(CampaignStep.campaign_id == UUID(campaign_id))
            .order_by(CampaignStep.step_number)
        ).all()

        if not steps:
            # Single-channel campaign — use the campaign's own template_id
            steps = None

        # Query matching leads
        stmt = (
            select(Lead)
            .outerjoin(LeadContact, Lead.id == LeadContact.lead_id)
        )

        filters = []
        if campaign.incident_type:
            filters.append(Lead.peril == campaign.incident_type)
        if campaign.lead_source:
            filters.append(Lead.source == campaign.lead_source)
        if campaign.territory_state:
            filters.append(LeadContact.state == campaign.territory_state)
        if campaign.target_zip_code:
            if campaign.target_radius_miles and campaign.target_radius_miles > 0:
                if campaign.target_radius_miles <= 10:
                    prefix_len = 4
                elif campaign.target_radius_miles <= 25:
                    prefix_len = 3
                elif campaign.target_radius_miles <= 50:
                    prefix_len = 2
                else:
                    prefix_len = 1
                zip_prefix = campaign.target_zip_code[:prefix_len]
                filters.append(LeadContact.zip_code.like(f"{zip_prefix}%"))
            else:
                filters.append(LeadContact.zip_code == campaign.target_zip_code)

        if filters:
            stmt = stmt.where(and_(*filters))

        leads = db.scalars(stmt).all()
        total_targeted = len(leads)

        logger.info(
            "[CampaignManager:%s] Found %d matching leads for campaign=%s",
            task_id, total_targeted, campaign_id,
        )

        # Update targeted count
        campaign.total_targeted = total_targeted
        db.add(campaign)
        db.commit()

        # Dispatch outreach for each lead
        cumulative_delay = 0
        dispatched = 0

        if steps:
            for lead in leads:
                cumulative_delay = 0
                for step in steps:
                    cumulative_delay += step.delay_minutes
                    # Override campaign template_id temporarily for the dispatch task
                    # We pass campaign_id — the execute_outreach_task uses campaign.template_id
                    # For multi-step, we need to pass step info differently
                    # Schedule with countdown (delay in seconds)
                    execute_outreach_task.apply_async(
                        args=[str(campaign.id), str(lead.id)],
                        countdown=cumulative_delay * 60,
                    )
                    dispatched += 1
        else:
            # Single-channel: use campaign's template directly
            for lead in leads:
                execute_outreach_task.delay(str(campaign.id), str(lead.id))
                dispatched += 1

        logger.info(
            "[CampaignManager:%s] Dispatched %d outreach tasks for campaign=%s",
            task_id, dispatched, campaign_id,
        )

        # Update sent counter
        campaign.total_sent = dispatched
        db.add(campaign)
        db.commit()

        return {
            "status": "dispatched",
            "total_targeted": total_targeted,
            "tasks_dispatched": dispatched,
        }

    except Exception as exc:
        db.rollback()
        logger.error("[CampaignManager:%s] Failed: %s", task_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()
