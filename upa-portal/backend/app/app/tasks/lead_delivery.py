#!/usr/bin/env python

"""Celery task for delivering lead assignment notifications (SMS + email + in-app)"""

import logging
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.communication_log import CommunicationLog
from app.models.lead import Lead
from app.models.lead_delivery_log import LeadDeliveryLog
from app.models.lead_distribution import LeadDistributionHistory
from app.models.user import User
from app.utils.emails import get_project_context, send_email
from app.utils.jinja import render_template
from app.utils.sms import get_sms_provider

logger = logging.getLogger(__name__)


def _build_lead_url(lead_id: str) -> str:
    """Build the direct portal link to a lead."""
    base = settings.PROJECT_URL.rstrip("/")
    return f"{base}/#/app/leads/{lead_id}"


def _build_loss_address(lead) -> str:
    """Build a formatted loss address string from lead contact fields."""
    contact = lead.contact
    if not contact:
        return "N/A"
    parts = [
        contact.address_loss,
        contact.city_loss,
        contact.state_loss,
        contact.zip_code_loss,
    ]
    filled = [p for p in parts if p]
    return ", ".join(filled) if filled else "N/A"


def _get_agent_phone(agent) -> str | None:
    """Get agent phone number from UserMeta."""
    meta = getattr(agent, "user_meta", None)
    if meta:
        # user_meta is a list relationship (one-to-many via back_populates)
        # but in practice it's one-to-one; handle both list and single object
        if isinstance(meta, list):
            return meta[0].phone_number if meta else None
        return getattr(meta, "phone_number", None)
    return None


@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    name="app.tasks.lead_delivery.deliver_lead_assignment",
)
def deliver_lead_assignment(
    self,
    lead_id: str,
    agent_id: str,
    territory_id: str,
    lead_type: str,
):
    """Send SMS + email + in-app notification to an agent about their new lead assignment."""
    task_id = self.request.id
    logger.info(
        "[Task:%s] Delivering lead %s assignment to agent %s (type=%s)",
        task_id, lead_id, agent_id, lead_type,
    )

    db = SessionLocal()
    try:
        # Load agent and lead
        agent = db.get(User, agent_id)
        lead = db.get(Lead, lead_id)

        if not agent:
            logger.error("[Task:%s] Agent %s not found", task_id, agent_id)
            return
        if not lead:
            logger.error("[Task:%s] Lead %s not found", task_id, lead_id)
            return

        # Find the distribution history record for this assignment
        dist_history = (
            db.query(LeadDistributionHistory)
            .filter(
                LeadDistributionHistory.lead_id == lead_id,
                LeadDistributionHistory.assigned_agent_id == agent_id,
                LeadDistributionHistory.territory_id == territory_id,
            )
            .order_by(LeadDistributionHistory.distributed_at.desc())
            .first()
        )
        dist_history_id = dist_history.id if dist_history else None

        territory_name = (
            dist_history.territory.name if dist_history and dist_history.territory else "Unknown"
        )

        lead_url = _build_lead_url(lead_id)
        loss_address = _build_loss_address(lead)

        # --- SMS Delivery ---
        _deliver_sms(db, agent, lead, lead_type, territory_name, loss_address, lead_url, dist_history_id)

        # --- Email Delivery ---
        _deliver_email(db, agent, lead, lead_type, territory_name, loss_address, lead_url, dist_history_id)

        # --- In-App Notification ---
        _deliver_in_app(db, agent, lead, lead_type, territory_name, loss_address, lead_url)

        db.commit()
        logger.info("[Task:%s] Delivery complete for agent %s", task_id, agent_id)

    except Exception as exc:
        db.rollback()
        logger.error("[Task:%s] Delivery failed: %s", task_id, exc, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        db.close()


def _deliver_sms(db, agent, lead, lead_type, territory_name, loss_address, lead_url, dist_history_id):
    """Send SMS to agent and log the attempt."""
    sms_provider = get_sms_provider()

    if not sms_provider:
        logger.info("SMS delivery skipped — Twilio is disabled")
        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="sms",
                delivery_status="skipped",
                delivery_error="Twilio is disabled",
            )
            db.add(log)
        return

    phone = _get_agent_phone(agent)
    if not phone:
        logger.warning("Agent %s has no phone number — skipping SMS", agent.id)
        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="sms",
                delivery_status="failed",
                delivery_error="Agent has no phone number",
            )
            db.add(log)
        return

    body = (
        f"UPA Lead Alert\n"
        f"Type: {lead_type.capitalize()}\n"
        f"Territory: {territory_name}\n"
        f"Loss Address: {loss_address}\n"
        f"View: {lead_url}"
    )
    result = sms_provider.send_sms(to=phone, body=body)

    log = LeadDeliveryLog(
        distribution_history_id=dist_history_id,
        agent_id=agent.id,
        lead_id=lead.id,
        channel="sms",
        delivery_status="sent" if result.success else "failed",
        sms_sent_at=datetime.now(timezone.utc) if result.success else None,
        twilio_message_sid=result.message_sid,
        delivery_error=result.error,
    )
    db.add(log)

    # Create CommunicationLog for SMS
    comm_log = CommunicationLog(
        lead_id=lead.id,
        agent_id=agent.id,
        channel="sms",
        purpose="lead_assignment",
        recipient_phone=phone,
        provider_message_id=result.message_sid,
        body_preview=body[:500],
        send_status="delivered" if result.success else "failed",
        failure_reason=result.error if not result.success else None,
        sent_at=datetime.now(timezone.utc) if result.success else None,
        delivered_at=datetime.now(timezone.utc) if result.success else None,
    )
    db.add(comm_log)


def _deliver_email(db, agent, lead, lead_type, territory_name, loss_address, lead_url, dist_history_id):
    """Send email to agent and log the attempt."""
    if not agent.email:
        logger.warning("Agent %s has no email — skipping email delivery", agent.id)
        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="email",
                delivery_status="failed",
                delivery_error="Agent has no email address",
            )
            db.add(log)
        return

    if not settings.EMAILS_ENABLED:
        logger.info("Email delivery skipped — emails are disabled")
        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="email",
                delivery_status="skipped",
                delivery_error="Emails are disabled",
            )
            db.add(log)
        return

    try:
        agent_name = f"{agent.first_name} {agent.last_name}"
        contact_name = lead.contact.full_name if lead.contact else "N/A"
        contact_phone = lead.contact.phone_number if lead.contact else "N/A"

        subject = f"New {lead_type.capitalize()} Lead Assigned – {territory_name}"
        context = {
            **get_project_context(email_tagline="Lead Assignment"),
            "agent_name": agent_name,
            "lead_type": lead_type.capitalize(),
            "territory_name": territory_name,
            "contact_name": contact_name,
            "contact_phone": contact_phone,
            "loss_address": loss_address,
            "lead_ref": lead.ref_number,
            "lead_url": lead_url,
        }
        body_html = render_template(
            template="lead_assignment.html", context=context,
        )
        body_plain = (
            f"Hi {agent_name},\n\n"
            f"A new {lead_type} lead has been assigned to you in {territory_name}.\n\n"
            f"Contact: {contact_name}\n"
            f"Phone: {contact_phone}\n"
            f"Loss Address: {loss_address}\n\n"
            f"View lead: {lead_url}\n\n"
            f"– The {settings.PROJECT_NAME} Team"
        )

        # Create CommunicationLog before sending
        comm_log = CommunicationLog(
            lead_id=lead.id,
            agent_id=agent.id,
            channel="email",
            purpose="lead_assignment",
            template_type="lead_assignment",
            recipient_email=agent.email,
            subject=subject,
            body_preview=body_plain[:500],
            send_status="pending",
        )
        db.add(comm_log)
        db.flush()  # get the ID

        msg_id = send_email(
            to=agent.email,
            subject=subject,
            body_html=body_html,
            body_plain=body_plain,
            communication_log_id=str(comm_log.id),
        )

        now = datetime.now(timezone.utc)
        comm_log.send_status = "delivered"
        comm_log.sent_at = now
        comm_log.delivered_at = now
        comm_log.provider_message_id = msg_id

        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="email",
                delivery_status="sent",
                email_sent_at=now,
            )
            db.add(log)

    except Exception as exc:
        logger.error("Email delivery failed for agent %s: %s", agent.id, exc)

        # Update comm_log if it was created
        try:
            if 'comm_log' in locals() and comm_log:
                comm_log.send_status = "failed"
                comm_log.failure_reason = str(exc)[:1000]
        except Exception:
            pass

        if dist_history_id:
            log = LeadDeliveryLog(
                distribution_history_id=dist_history_id,
                agent_id=agent.id,
                lead_id=lead.id,
                channel="email",
                delivery_status="failed",
                delivery_error=str(exc)[:500],
            )
            db.add(log)


def _deliver_in_app(db, agent, lead, lead_type, territory_name, loss_address, lead_url):
    """Create an in-app notification for the agent."""
    from app.utils.notifications import create_notification

    try:
        create_notification(
            db,
            user_id=agent.id,
            title=f"New {lead_type.capitalize()} Lead – {territory_name}",
            message=(
                f"A new {lead_type} lead has been assigned to you.\n"
                f"Territory: {territory_name}\n"
                f"Loss Address: {loss_address}"
            ),
            link=lead_url,
            notification_type="lead_assignment",
            lead_id=lead.id,
        )
    except Exception as exc:
        logger.error("In-app notification failed for agent %s: %s", agent.id, exc)


@celery_app.task(name="app.tasks.lead_delivery.notify_announcement")
def notify_announcement(announcement_id: str, title: str, content_preview: str, creator_id: str):
    """Create in-app notifications for all active non-customer users when an announcement is posted."""
    from sqlalchemy import select
    from app.models.role import Role
    from app.utils.notifications import create_notification

    db = SessionLocal()
    try:
        # Query all active, non-customer users
        stmt = (
            select(User)
            .join(Role, User.role_id == Role.id)
            .where(
                User.is_active == True,
                Role.name != "customer",
                User.id != creator_id,
            )
        )
        users = db.execute(stmt).scalars().all()

        for user in users:
            create_notification(
                db,
                user_id=user.id,
                title=f"New Announcement: {title}",
                message=content_preview,
                notification_type="announcement",
                link="/#/app/announcements",
            )

        db.commit()
        logger.info(
            "Announcement notifications created for %d users (announcement=%s)",
            len(users), announcement_id,
        )
    except Exception as exc:
        db.rollback()
        logger.error("notify_announcement failed: %s", exc, exc_info=True)
    finally:
        db.close()
