#!/usr/bin/env python

"""
Lead Outcome Service
====================
Records outcome of each contact attempt after a lead is distributed to an agent.
Executes automation rules based on the outcome status.
"""

import logging
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app import crud
from app.core.enums import (
    ClaimFeeType,
    ClaimPhases,
    LeadOutcomeCategory,
    LeadOutcomeStatus,
    LeadStatus,
    OUTCOME_STATUS_CATEGORIES,
    Priority,
    TaskStatus,
    TaskType,
)
from app.models.lead import Lead
from app.models.lead_outcome import LeadOutcome
from app.models.user import User
from app.schemas.client import ClientCreate
from app.schemas.claim import ClaimCreate
from app.schemas.claim_contact import ClaimContactCreate
from app.schemas.communication_log import CommunicationLogCreate
from app.schemas.lead_outcome import LeadOutcomeCreate, LeadOutcomeCreateDB
from app.schemas.lead_task import LeadTaskCreateDB

logger = logging.getLogger(__name__)


class LeadOutcomeService:
    def __init__(self, db_session: Session):
        self.db_session = db_session

    def record_outcome(
        self,
        lead_id: UUID,
        outcome_in: LeadOutcomeCreate,
        current_user: User,
    ) -> LeadOutcome:
        # 1. Validate lead exists
        lead_obj = crud.lead.get(self.db_session, obj_id=lead_id)
        if not lead_obj:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found.",
            )

        # 2. Resolve enum for status and determine category
        try:
            outcome_enum = LeadOutcomeStatus(outcome_in.outcome_status)
        except ValueError:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid outcome_status: {outcome_in.outcome_status}",
            )

        category_enum = OUTCOME_STATUS_CATEGORIES[outcome_enum]

        # 3. Execute automation and capture action name
        automation_triggered = None
        try:
            automation_triggered = self._run_automation(
                lead_obj, outcome_enum, outcome_in, current_user
            )
        except Exception:
            logger.exception(
                "Automation failed for lead %s with outcome %s",
                lead_id,
                outcome_in.outcome_status,
            )

        # 4. Persist outcome
        obj_in = LeadOutcomeCreateDB(
            outcome_status=outcome_enum.value,
            category=category_enum.value,
            notes=outcome_in.notes,
            lead_id=lead_id,
            recorded_by_id=current_user.id,
            automation_triggered=automation_triggered,
        )
        outcome_obj = crud.lead_outcome.create(self.db_session, obj_in=obj_in)

        # 5. Denormalize last outcome status on the lead for quick list display
        crud.lead.update(
            self.db_session,
            db_obj=lead_obj,
            obj_in={"last_outcome_status": outcome_enum.value},
        )

        return outcome_obj

    # ------------------------------------------------------------------
    # Automation dispatcher
    # ------------------------------------------------------------------

    def _run_automation(
        self,
        lead: Lead,
        outcome_status: LeadOutcomeStatus,
        outcome_in: LeadOutcomeCreate,
        current_user: User,
    ) -> str | None:
        if outcome_status == LeadOutcomeStatus.WANTS_MORE_INFO:
            return self._automation_send_brochure(lead)
        if outcome_status == LeadOutcomeStatus.APPOINTMENT_SCHEDULED:
            return self._automation_create_meeting_task(lead, outcome_in, current_user)
        if outcome_status == LeadOutcomeStatus.SIGNED_CLIENT:
            self._mark_rescue_converted_if_applicable(lead)
            return self._automation_convert_to_claim(lead, current_user)
        if outcome_status == LeadOutcomeStatus.CALL_BACK_LATER_TODAY:
            return self._automation_create_callback_task(
                lead, current_user, hours_from_now=2, callback_date=outcome_in.callback_date
            )
        if outcome_status == LeadOutcomeStatus.CALL_BACK_TOMORROW:
            return self._automation_create_callback_task(
                lead, current_user, hours_from_now=24, callback_date=outcome_in.callback_date
            )
        if outcome_status == LeadOutcomeStatus.WRONG_NUMBER:
            return self._automation_mark_wrong_number(lead, current_user)
        return None

    # ------------------------------------------------------------------
    # Automation: Send brochure email
    # ------------------------------------------------------------------

    def _automation_send_brochure(self, lead: Lead) -> str | None:
        contact = lead.contact
        if not contact:
            logger.info("No contact for lead %s — skipping brochure", lead.id)
            return None

        actions: list[str] = []

        # Send brochure email
        if contact.email:
            from app.core.celery_app import celery_app

            celery_app.send_task(
                "app.tasks.lead_outcome.send_brochure_email",
                args=[contact.email, contact.full_name or ""],
                kwargs={"lead_id": str(lead.id)},
            )
            actions.append("email")

        # Send SMS with information link (skip if phone marked invalid)
        if contact.phone_number and getattr(contact, "phone_is_valid", True):
            from app.utils.sms import get_sms_provider

            sms = get_sms_provider()
            if sms:
                body = (
                    f"Hi {contact.full_name or 'there'}, thanks for your interest! "
                    f"Here is more information about our public adjusting services: "
                    f"https://upaclaim.com/info"
                )
                result = sms.send_sms(to=contact.phone_number, body=body)
                if result.success:
                    actions.append("sms")
                else:
                    logger.warning("SMS failed for lead %s: %s", lead.id, result.error)
            else:
                logger.info("SMS provider not configured — skipping SMS for lead %s", lead.id)

        if not actions:
            logger.info("No email or phone for lead %s — skipping brochure", lead.id)
            return None

        # Record the timestamp when info was sent
        crud.lead.update(
            self.db_session,
            db_obj=lead,
            obj_in={"info_sent_at": datetime.utcnow()},
        )

        return "send_brochure_" + "_".join(actions)

    # ------------------------------------------------------------------
    # Automation: Create meeting task
    # ------------------------------------------------------------------

    def _automation_create_meeting_task(
        self, lead: Lead, outcome_in: LeadOutcomeCreate, current_user: User
    ) -> str:
        appointment_dt = outcome_in.appointment_date
        if appointment_dt:
            due = appointment_dt.date() if isinstance(appointment_dt, datetime) else appointment_dt
        else:
            due = self._next_business_day()

        task_in = LeadTaskCreateDB(
            title=f"Appointment with {lead.contact.full_name if lead.contact else 'Contact'}",
            description="Meeting scheduled via lead outcome recording.",
            task_type=TaskType.MEETING,
            priority=Priority.HIGH,
            status=TaskStatus.TODO,
            due_date=due,
            assignee_id=lead.assigned_to or current_user.id,
            lead_id=lead.id,
        )
        crud.lead_task.create(self.db_session, obj_in=task_in)
        return "create_meeting_task"

    # ------------------------------------------------------------------
    # Automation: Create callback reminder task
    # ------------------------------------------------------------------

    def _automation_create_callback_task(
        self, lead: Lead, current_user: User, hours_from_now: int,
        callback_date: datetime | None = None,
    ) -> str:
        contact_name = lead.contact.full_name if lead.contact else "Contact"
        if callback_date:
            due = callback_date
            priority = Priority.HIGH
        else:
            due = datetime.utcnow() + timedelta(hours=hours_from_now)
            priority = Priority.HIGH if hours_from_now <= 4 else Priority.MEDIUM

        task_in = LeadTaskCreateDB(
            title=f"Callback: {contact_name} — Lead #{lead.ref_number}",
            description="Follow-up call scheduled from lead outcome.",
            task_type=TaskType.PHONE_CALL,
            priority=priority,
            status=TaskStatus.TODO,
            due_date=due.date(),
            assignee_id=lead.assigned_to or current_user.id,
            lead_id=lead.id,
        )
        crud.lead_task.create(self.db_session, obj_in=task_in)
        return "create_callback_task"

    # ------------------------------------------------------------------
    # Automation: Convert signed client to claim
    # ------------------------------------------------------------------

    def _automation_convert_to_claim(
        self,
        lead: Lead,
        current_user: User,
        contract_sign_date: date | None = None,
        fee_type_override: str | None = None,
        fee_override: float | None = None,
    ) -> str:
        # 1. Update lead status
        crud.lead.update(
            self.db_session,
            db_obj=lead,
            obj_in={"status": LeadStatus.SIGNED.value},
        )

        # 2. Create client from lead contact
        contact = lead.contact
        if not contact:
            logger.warning("No contact on lead %s — cannot convert to claim", lead.id)
            return "convert_to_claim_partial"

        client_obj_in = ClientCreate(
            full_name=contact.full_name,
            full_name_alt=contact.full_name_alt,
            email=contact.email,
            email_alt=contact.email_alt,
            phone_number=contact.phone_number,
            phone_number_alt=contact.phone_number_alt,
            address=contact.address,
            city=contact.city,
            state=contact.state,
            zip_code=contact.zip_code,
            belongs_to=lead.assigned_to or current_user.id,
        )
        client_obj = crud.client.create_if_not_exist(self.db_session, obj_in=client_obj_in)

        # 3. Link client to lead
        crud.lead.update(
            self.db_session,
            db_obj=lead,
            obj_in={"client_id": client_obj.id},
        )

        # 4. Build loss address from lead contact
        claim_contact = ClaimContactCreate(
            address_loss=contact.address_loss or contact.address,
            city_loss=contact.city_loss or contact.city,
            state_loss=contact.state_loss or contact.state,
            zip_code_loss=contact.zip_code_loss or contact.zip_code,
        )

        # 5. Resolve fee
        resolved_fee_type = ClaimFeeType.PERCENTAGE
        if fee_type_override == "flat":
            resolved_fee_type = ClaimFeeType.FIXED
        elif fee_type_override == "percentage":
            resolved_fee_type = ClaimFeeType.PERCENTAGE

        resolved_fee = fee_override if fee_override is not None else (getattr(lead, "fee", None) or 10.0)

        # 6. Create claim
        claim_in = ClaimCreate(
            loss_date=lead.loss_date,
            peril=lead.peril,
            insurance_company=lead.insurance_company,
            policy_number=lead.policy_number,
            claim_number=lead.claim_number,
            source=lead.source,
            source_info=lead.source_info,
            fee_type=resolved_fee_type,
            fee=resolved_fee,
            current_phase=ClaimPhases.CLAIM_REPORTED,
            assigned_to=lead.assigned_to or current_user.id,
            client_id=client_obj.id,
            signed_by=current_user.id,
            contract_sign_date=contract_sign_date or date.today(),
            claim_contact=claim_contact,
        )
        claim_obj = crud.claim.create(self.db_session, obj_in=claim_in)

        return "convert_to_claim"

    # ------------------------------------------------------------------
    # Automation: Mark wrong number
    # ------------------------------------------------------------------

    def _automation_mark_wrong_number(self, lead: Lead, current_user: User) -> str:
        contact = lead.contact
        if not contact:
            logger.info("No contact for lead %s — skipping wrong number", lead.id)
            return "mark_wrong_number"

        # 1. Mark the phone number as invalid
        contact.phone_is_valid = False
        self.db_session.add(contact)
        self.db_session.flush()

        # 2. Log the event in communications history
        log_in = CommunicationLogCreate(
            lead_id=lead.id,
            agent_id=current_user.id,
            channel="phone",
            purpose="wrong_number",
            recipient_phone=contact.phone_number,
            subject="Wrong Number",
            body_preview=(
                f"Phone number {contact.phone_number} marked as invalid. "
                f"Future automated calls and texts to this number are disabled."
            ),
            send_status="failed",
            failure_reason="wrong-number",
        )
        crud.communication_log.create(self.db_session, obj_in=log_in)

        logger.info(
            "Marked phone %s as invalid for lead %s (contact %s)",
            contact.phone_number,
            lead.id,
            contact.id,
        )
        return "mark_wrong_number"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _mark_rescue_converted_if_applicable(self, lead: Lead) -> None:
        """If this lead was rescued, mark the rescue log as converted."""
        if not lead.is_rescued:
            return
        try:
            from app.services.rescue_service import RescueService

            rescue_svc = RescueService(self.db_session)
            rescue_svc.mark_rescue_converted(lead.id)
        except Exception:
            logger.warning(
                "Failed to mark rescue converted for lead %s", lead.id,
                exc_info=True,
            )

    @staticmethod
    def _next_business_day() -> date:
        today = date.today()
        next_day = today + timedelta(days=1)
        while next_day.weekday() >= 5:  # Saturday=5, Sunday=6
            next_day += timedelta(days=1)
        return next_day
