#!/usr/bin/env python

"""Celery task for running skip trace lookups on leads."""

import json
from datetime import datetime, timezone
from uuid import UUID

from app.core.celery_app import celery_app, celery_log
from app.db.session import SessionLocal
from app.models.lead import Lead
from app.models.lead_skip_trace import LeadSkipTrace
from app.utils.skip_trace import skip_trace_address, SkipTraceResident2


@celery_app.task(
    bind=True,
    queue="main-queue",
    max_retries=2,
    retry_backoff=True,
    name="app.tasks.skip_trace.run_skiptrace_for_lead",
)
def run_skiptrace_for_lead(self, lead_id: str, force: bool = False) -> str:
    """
    Run a skip trace lookup for a lead using the configured provider.

    Parameters
    ----------
    lead_id : str
        UUID string of the lead.
    force : bool
        If True, re-run even if a successful result already exists.
    """
    celery_log.info("Skip trace task started for lead %s (force=%s)", lead_id, force)

    db_session = SessionLocal()
    try:
        with db_session as session:
            lead = session.get(Lead, UUID(lead_id))
            if not lead:
                celery_log.warning("Skip trace: lead %s not found", lead_id)
                return f"Lead {lead_id} not found."

            # Check for existing result
            existing = session.query(LeadSkipTrace).filter_by(lead_id=lead.id).first()
            if existing and existing.skiptrace_status == "success" and not force:
                celery_log.info("Skip trace: lead %s already has successful result, skipping", lead_id)
                return f"Lead {lead_id} already has successful skip trace."

            # Build address from lead contact
            contact = lead.contact
            if not contact:
                celery_log.warning("Skip trace: lead %s has no contact record", lead_id)
                return f"Lead {lead_id} has no contact."

            # Prefer loss address, fallback to mailing address
            street = contact.address_loss or contact.address or ""
            city = contact.city_loss or contact.city or ""
            state = contact.state_loss or contact.state or ""
            zip_code = contact.zip_code_loss or contact.zip_code or ""

            if not street:
                celery_log.warning("Skip trace: lead %s has no address", lead_id)
                _upsert_skip_trace(session, lead.id, existing, status="failed")
                return f"Lead {lead_id} has no address."

            full_address = f"{street}, {city}, {state} {zip_code}".strip().rstrip(",")

            # Run the lookup
            celery_log.info("Skip trace: looking up address '%s' for lead %s", full_address, lead_id)
            result = skip_trace_address(full_address)

            if result and result.residents:
                resident = result.residents[0]  # Primary owner

                # Use structured name if available (SkipTraceResident2)
                if isinstance(resident, SkipTraceResident2):
                    first_name = resident.first_name or None
                    middle_name = resident.middle_name or None
                    last_name = resident.last_name or None
                    mailing_street = None
                    mailing_street2 = None
                    mailing_city = None
                    mailing_state = None
                    mailing_zip = None
                    if resident.mailing_address:
                        ma = resident.mailing_address
                        mailing_street = ma.street or None
                        mailing_street2 = ma.street2 or None
                        mailing_city = ma.city or None
                        mailing_state = ma.state or None
                        mailing_zip = ma.zip_code or None
                    raw_obj = resident.raw_response
                else:
                    # Fallback: parse name from full_name string
                    name_parts = resident.full_name.split() if resident.full_name else []
                    first_name = name_parts[0] if len(name_parts) >= 1 else None
                    middle_name = name_parts[1] if len(name_parts) >= 3 else None
                    last_name = name_parts[-1] if len(name_parts) >= 2 else None
                    mailing_street = mailing_street2 = mailing_city = mailing_state = mailing_zip = None
                    raw_obj = None

                phone = resident.phone_numbers[0] if resident.phone_numbers else None
                email = resident.emails[0] if resident.emails else None

                status = "success" if resident.full_name else "partial"

                # Build raw response JSON — use raw_obj from API if available
                if raw_obj:
                    try:
                        raw_response = json.dumps(raw_obj, default=str)
                    except Exception:
                        raw_response = json.dumps({"full_name": resident.full_name})
                else:
                    raw_response = json.dumps(
                        [
                            {
                                "full_name": r.full_name,
                                "phone_numbers": r.phone_numbers,
                                "emails": r.emails,
                                "age": r.age,
                            }
                            for r in result.residents
                        ]
                    )

                _upsert_skip_trace(
                    session,
                    lead.id,
                    existing,
                    owner_first_name=first_name,
                    owner_middle_name=middle_name,
                    owner_last_name=last_name,
                    owner_full_name=resident.full_name,
                    owner_age=resident.age,
                    owner_email=email,
                    owner_phone=phone,
                    owner_mailing_street=mailing_street,
                    owner_mailing_street2=mailing_street2,
                    owner_mailing_city=mailing_city,
                    owner_mailing_state=mailing_state,
                    owner_mailing_zip=mailing_zip,
                    skiptrace_raw_response=raw_response,
                    status=status,
                )

                celery_log.info(
                    "Skip trace %s for lead %s: owner=%s, phone=%s, email=%s",
                    status, lead_id, resident.full_name, phone, email,
                )
                return f"Skip trace {status} for lead {lead_id}: {resident.full_name}"
            else:
                _upsert_skip_trace(session, lead.id, existing, status="failed")
                celery_log.info("Skip trace: no results for lead %s", lead_id)
                return f"Skip trace failed for lead {lead_id}: no results."

    except Exception as exc:
        celery_log.error("Skip trace task error for lead %s: %s", lead_id, exc, exc_info=True)
        # Try to mark as failed
        try:
            db_retry = SessionLocal()
            with db_retry as session:
                existing = session.query(LeadSkipTrace).filter_by(lead_id=UUID(lead_id)).first()
                _upsert_skip_trace(session, UUID(lead_id), existing, status="failed")
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db_session.close()


def _upsert_skip_trace(
    session,
    lead_id: UUID,
    existing: LeadSkipTrace | None,
    *,
    owner_first_name: str | None = None,
    owner_middle_name: str | None = None,
    owner_last_name: str | None = None,
    owner_full_name: str | None = None,
    owner_age: str | None = None,
    owner_email: str | None = None,
    owner_phone: str | None = None,
    owner_mailing_street: str | None = None,
    owner_mailing_street2: str | None = None,
    owner_mailing_city: str | None = None,
    owner_mailing_state: str | None = None,
    owner_mailing_zip: str | None = None,
    skiptrace_raw_response: str | None = None,
    status: str = "failed",
) -> LeadSkipTrace:
    """Create or update a LeadSkipTrace record."""
    now = datetime.now(timezone.utc)

    fields = dict(
        owner_first_name=owner_first_name,
        owner_middle_name=owner_middle_name,
        owner_last_name=owner_last_name,
        owner_full_name=owner_full_name,
        owner_age=owner_age,
        owner_email=owner_email,
        owner_phone=owner_phone,
        owner_mailing_street=owner_mailing_street,
        owner_mailing_street2=owner_mailing_street2,
        owner_mailing_city=owner_mailing_city,
        owner_mailing_state=owner_mailing_state,
        owner_mailing_zip=owner_mailing_zip,
        skiptrace_raw_response=skiptrace_raw_response,
        skiptrace_status=status,
        skiptrace_ran_at=now,
    )

    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        session.add(existing)
        session.commit()
        return existing
    else:
        record = LeadSkipTrace(lead_id=lead_id, **fields)
        session.add(record)
        session.commit()
        return record
