#!/usr/bin/env python

"""Routes for the Fire Incidents module"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import get_service_locator
from app.core.config import settings
from app.core.rbac import Modules
from app.models.communication_log import CommunicationLog
from app.models.fire_incident import FireIncident
from app.schemas.lead import LeadCreate
from app.schemas.lead_contact import LeadContactCreate
from app.service_locator import AppServiceLocator
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.schemas.property_intelligence import PropertyIntelligenceCreate
from app.utils.skip_trace import skip_trace_address, SKIP_TRACE_CALL_TYPES
from app.utils.territory_filter import get_fire_incident_territory_filters

router = APIRouter()

permissions = Permissions(Modules.FIRE_INCIDENT.value)
lead_permissions = Permissions(Modules.LEAD.value)
crud_util = CrudUtil(crud.fire_incident)


@router.get(
    "",
    summary="List Fire Incidents",
    response_description="Paginated list of fire incidents",
    response_model=CustomPage[schemas.FireIncident],
    dependencies=[Depends(permissions.read())],
)
def read_fire_incidents(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    agency_id: Annotated[UUID | None, Query(description="Filter by agency UUID.")] = None,
    call_type: Annotated[str | None, Query(description="Filter by call type code (e.g. 'SF').")] = None,
    is_active: Annotated[bool | None, Query(description="Filter by active status (legacy).")] = None,
    dispatch_status: Annotated[str | None, Query(description="Filter by dispatch status: active, cleared, archived.")] = None,
    date_from: Annotated[datetime | None, Query(description="Filter received_at >= date_from.")] = None,
    date_to: Annotated[datetime | None, Query(description="Filter received_at <= date_to.")] = None,
    data_source: Annotated[str | None, Query(description="Filter by data source (pulsepoint, socrata, nifc, firms).")] = None,
) -> Any:
    """
    Retrieve fire incidents with optional filtering.

    Supports filtering by agency, call type, active status, date range, and data source.
    Results are paginated and ordered by received_at descending.
    """
    filters = []

    if agency_id is not None:
        filters.append(FireIncident.agency_id == agency_id)
    if call_type is not None:
        if "," in call_type:
            codes = [c.strip() for c in call_type.split(",") if c.strip()]
            filters.append(FireIncident.call_type.in_(codes))
        else:
            filters.append(FireIncident.call_type == call_type)
    else:
        # Auto-filter by enabled call types when no explicit filter is given
        enabled_codes = crud.call_type_config.get_enabled_codes(db_session)
        if enabled_codes:
            filters.append(FireIncident.call_type.in_(enabled_codes))
    if is_active is not None:
        filters.append(FireIncident.is_active.is_(is_active))
    if dispatch_status is not None:
        if "," in dispatch_status:
            statuses = [s.strip() for s in dispatch_status.split(",") if s.strip()]
            filters.append(FireIncident.dispatch_status.in_(statuses))
        else:
            filters.append(FireIncident.dispatch_status == dispatch_status)
    # NOTE: When date_from is provided (24h view), do NOT require is_active=True.
    # Incidents that cleared from active dispatch should still appear in the
    # time-bounded view — the time window is the visibility boundary.
    if date_from is not None:
        # Ensure timezone-aware comparison (treat naive as UTC)
        if date_from.tzinfo is None:
            date_from = date_from.replace(tzinfo=timezone.utc)
        filters.append(FireIncident.received_at >= date_from)
    if date_to is not None:
        if date_to.tzinfo is None:
            date_to = date_to.replace(tzinfo=timezone.utc)
        filters.append(FireIncident.received_at <= date_to)
    if data_source is not None:
        filters.append(FireIncident.data_source == data_source)

    # Apply territory-based access filters
    territory_filters = get_fire_incident_territory_filters(db_session, current_user)
    if territory_filters:
        filters.extend(territory_filters)

    logger.info(
        "[FireIncidents] Query: user=%s call_type=%s date_from=%s "
        "territory_filters=%d total_filters=%d",
        current_user.id,
        call_type,
        date_from,
        len(territory_filters),
        len(filters),
    )

    return crud.fire_incident.get_multi(
        db_session,
        filters=filters if filters else None,
        order_by=[FireIncident.received_at.desc()],
    )


@router.get(
    "/{incident_id}",
    summary="Get Fire Incident",
    response_description="Fire incident detail",
    response_model=schemas.FireIncident,
    dependencies=[Depends(permissions.read())],
)
def read_fire_incident(
    incident_id: Annotated[UUID, Path(description="The incident UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single fire incident by its UUID."""
    return crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)


@router.get(
    "/{incident_id}/skip-trace",
    summary="Skip Trace Fire Incident Address",
    response_description="Property owner lookup results",
    response_model=schemas.SkipTraceResponse,
    dependencies=[Depends(permissions.read())],
)
def skip_trace_incident(
    incident_id: Annotated[UUID, Path(description="The fire incident UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Look up property owner information for a fire incident address.

    Uses the configured skip trace provider (e.g. TruePeopleSearch via Scrape.do)
    to find residents at the incident address. Only runs for eligible call types
    (SF, CF). Returns an empty residents list if the provider is disabled, the
    call type is ineligible, or the lookup fails.
    """
    from app.core.config import settings

    incident = crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)
    address = incident.address or ""
    call_type = incident.call_type or ""

    # Only auto-trace for eligible call types
    if call_type.upper() not in SKIP_TRACE_CALL_TYPES:
        return schemas.SkipTraceResponse(
            residents=[],
            source=settings.SKIP_TRACE_PROVIDER,
            address_queried=address,
        )

    result = skip_trace_address(address)

    if result is None:
        return schemas.SkipTraceResponse(
            residents=[],
            source=settings.SKIP_TRACE_PROVIDER,
            address_queried=address,
        )

    return schemas.SkipTraceResponse(
        residents=[
            schemas.SkipTraceResident(
                full_name=r.full_name,
                phone_numbers=r.phone_numbers,
                emails=r.emails,
                age=r.age,
            )
            for r in result.residents
        ],
        source=settings.SKIP_TRACE_PROVIDER,
        address_queried=address,
    )


@router.get(
    "/{incident_id}/property-intelligence",
    summary="Get Property Intelligence for Fire Incident",
    response_description="Property intelligence record (may be pending enrichment)",
    response_model=schemas.PropertyIntelligence,
    dependencies=[Depends(permissions.read())],
)
def get_property_intelligence(
    incident_id: Annotated[UUID, Path(description="The fire incident UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Fetch property intelligence for a fire incident.

    Returns the existing record if one exists. If none exists, creates a
    new row with status='pending' so the UI can display it immediately.
    The enrichment service will populate the data when the API key is configured.
    """
    # Return existing record
    existing = crud.property_intelligence.get_by_incident_id(db_session, incident_id=incident_id)
    if existing:
        return existing

    # Create a pending record
    incident = crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)
    intel_in = PropertyIntelligenceCreate(
        incident_id=incident_id,
        address=incident.address or "",
        status="pending",
    )
    return crud.property_intelligence.create(db_session, obj_in=intel_in)


@router.post(
    "/{incident_id}/convert-to-lead",
    summary="Convert Fire Incident to Lead",
    response_description="The newly created lead",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.read()),
        Depends(lead_permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def convert_to_lead(
    incident_id: Annotated[UUID, Path(description="The fire incident UUID to convert.")],
    body: schemas.FireIncidentConvertToLead,
    db_session: Annotated[Session, Depends(get_db_session)],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """
    Convert a fire incident into a new lead.

    Pre-fills lead fields from the incident data and creates contact info
    from the user-supplied name/phone/email.
    """
    # Fetch the incident
    incident = crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)

    # Block re-conversion
    if incident.lead_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This fire incident has already been converted to a lead.",
        )

    # Build the lead creation payload
    lead_contact = LeadContactCreate(
        full_name=body.full_name,
        phone_number=body.phone_number,
        email=body.email,
        address_loss=incident.address,
    )

    lead_in = LeadCreate(
        peril=body.peril or incident.call_type_description or incident.call_type,
        loss_date=body.loss_date or incident.received_at,
        insurance_company=body.insurance_company,
        instructions_or_notes=body.instructions_or_notes,
        assigned_to=body.assigned_to,
        contact=lead_contact,
    )

    # Set audit context and create the lead via the service layer
    UserContext.set(current_user.id)
    lead_service = service_locator.get_lead_service()
    lead_entity = lead_service.create_lead(lead_in, current_user)

    # Link the new lead back to the fire incident
    incident.lead_id = lead_entity.id
    db_session.add(incident)
    db_session.commit()
    db_session.refresh(incident)

    return lead_entity


def _normalize_phone(phone: str) -> str:
    """Normalize a phone number to E.164 format (+1XXXXXXXXXX)."""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"


@router.post(
    "/{incident_id}/send-sms",
    summary="Send Outreach SMS for Fire Incident",
    response_description="SMS send result",
    response_model=schemas.SendSmsResponse,
    dependencies=[Depends(permissions.read())],
)
def send_outreach_sms(
    incident_id: Annotated[UUID, Path(description="The fire incident UUID.")],
    body: schemas.SendSmsRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Send a tracked SMS to a homeowner for a fire incident.

    Auto-creates a lead with status 'text-sent' if none is linked to the incident.
    Records the outbound SMS in CommunicationLog.
    """
    if not settings.TWILIO_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMS sending is not enabled. Configure Twilio settings.",
        )

    incident = crud_util.get_object_or_raise_exception(db_session, object_id=incident_id)
    normalized_phone = _normalize_phone(body.phone)

    # Auto-create lead if the incident doesn't have one
    lead_id = incident.lead_id
    if lead_id is None:
        lead_contact = LeadContactCreate(
            full_name="Unknown (Fire Outreach)",
            phone_number=normalized_phone,
            address_loss=incident.address,
        )
        lead_in = LeadCreate(
            peril=incident.call_type_description or incident.call_type,
            loss_date=incident.received_at,
            contact=lead_contact,
        )
        UserContext.set(current_user.id)
        lead_service = service_locator.get_lead_service()
        lead_entity = lead_service.create_lead(lead_in, current_user)
        lead_entity.status = "text-sent"
        lead_id = lead_entity.id
        incident.lead_id = lead_id
        db_session.add(incident)
        db_session.flush()

    # Create outbound CommunicationLog
    comm_log = CommunicationLog(
        lead_id=lead_id,
        agent_id=current_user.id,
        channel="sms",
        purpose="fire_outreach",
        direction="outbound",
        fire_incident_id=incident.id,
        recipient_phone=normalized_phone,
        body_preview=body.message[:500],
        send_status="pending",
    )
    db_session.add(comm_log)
    db_session.flush()

    # Send via Twilio
    from app.utils.sms.twilio_provider import TwilioSMSProvider

    provider = TwilioSMSProvider(
        account_sid=settings.TWILIO_ACCOUNT_SID,
        auth_token=settings.TWILIO_AUTH_TOKEN,
        from_number=settings.TWILIO_FROM_NUMBER,
    )
    result = provider.send_sms(to=normalized_phone, body=body.message)

    now = datetime.now(timezone.utc)
    if result.success:
        comm_log.send_status = "sent"
        comm_log.provider_message_id = result.message_sid
        comm_log.sent_at = now
    else:
        comm_log.send_status = "failed"
        comm_log.failure_reason = result.error

    # Update lead status to text-sent
    lead = db_session.get(models.Lead, lead_id)
    if lead and lead.status not in ("responded-yes", "converted"):
        lead.status = "text-sent"

    db_session.commit()
    db_session.refresh(comm_log)

    return schemas.SendSmsResponse(
        success=result.success,
        communication_log_id=comm_log.id,
        message="SMS sent successfully" if result.success else f"SMS failed: {result.error}",
    )
