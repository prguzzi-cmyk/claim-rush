#!/usr/bin/env python

"""Routes for the Leads module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy import case, desc, select
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam, get_service_locator
from app.core.rbac import Modules
from app.core.read_params_attrs import LeadSearch, LeadSort, Ordering
from app.core.response_manager import ResponseManager
from app.models import Lead
from app.services.lead_outcome_service import LeadOutcomeService
from app.models.communication_log import CommunicationLog
from app.models.lead_contact import LeadContact
from app.service_locator import AppServiceLocator
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.lead import validate_lead_ownership
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import LeadSqlStmtGenerator
from app.utils.territory_filter import get_lead_territory_filters

router = APIRouter()

response_manager = ResponseManager()
permissions = Permissions(Modules.LEAD.value)
crud_util_user = CrudUtil(crud.user)
crud_util = CrudUtil(crud.lead)
read_params = CommonReadParams(LeadSearch, LeadSort)
stmt_gen = LeadSqlStmtGenerator(Lead)


@router.get(
    "",
    summary="Read Leads",
    response_description="A list of leads",
    response_model=CustomPage[schemas.Lead],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_leads(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = LeadSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all leads."""
    from app.models import LeadContact

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    # Apply territory-based access filters
    territory_filters = get_lead_territory_filters(db_session, current_user)
    join_targets = stmt_gen.join_stmt()
    if territory_filters:
        if filters_stmt is None:
            filters_stmt = territory_filters
        else:
            filters_stmt.extend(territory_filters)
        # Ensure LeadContact is joined for territory filtering
        if join_targets is None:
            join_targets = set()
        join_targets.add(LeadContact)

    if crud.user.has_admin_privileges(current_user):
        leads_list = crud.lead.get_multi(
            db_session,
            join_target=join_targets,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    else:
        leads_list = crud.lead.get_assigned(
            db_session,
            current_user=current_user,
            join_target=join_targets,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )

    return leads_list


# Fire-workflow lead statuses used by the Response Desk
FIRE_WORKFLOW_STATUSES = (
    "skip-trace-pending",
    "text-sent",
    "responded-yes",
    "awaiting-call",
    "assigned",
    "converted",
    "closed",
)

# Priority order for sorting (lower = higher priority)
_STATUS_PRIORITY = {
    "responded-yes": 0,
    "awaiting-call": 1,
    "text-sent": 2,
    "skip-trace-pending": 3,
    "assigned": 4,
    "converted": 5,
    "closed": 6,
}


@router.get(
    "/response-desk",
    summary="Response Desk — Fire Lead Workflow",
    response_description="Leads in fire-workflow statuses with latest message preview",
    dependencies=[Depends(permissions.read())],
)
def response_desk(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> Any:
    """Return leads in fire-workflow statuses for the Response Desk view.

    Agents see only their assigned leads; admins see all.
    Sorted by status priority (responded-yes first), then updated_at desc.
    """
    from sqlalchemy import func, literal

    # Build priority case expression
    status_priority = case(
        *[(Lead.status == s, literal(p)) for s, p in _STATUS_PRIORITY.items()],
        else_=literal(99),
    )

    query = (
        select(Lead)
        .where(Lead.status.in_(FIRE_WORKFLOW_STATUSES))
        .where(Lead.is_removed.is_(False))
        .order_by(status_priority, desc(Lead.updated_at))
    )

    if not crud.user.has_admin_privileges(current_user):
        query = query.where(Lead.assigned_to == current_user.id)

    # Pagination
    total_q = select(func.count()).select_from(query.subquery())
    total = db_session.execute(total_q).scalar() or 0

    offset = (page - 1) * size
    leads = db_session.execute(query.offset(offset).limit(size)).scalars().all()

    # Fetch latest message preview per lead
    lead_ids = [l.id for l in leads]
    latest_msgs = {}
    if lead_ids:
        msg_q = (
            select(
                CommunicationLog.lead_id,
                CommunicationLog.body_preview,
                CommunicationLog.direction,
            )
            .where(CommunicationLog.lead_id.in_(lead_ids))
            .order_by(desc(CommunicationLog.created_at))
            .distinct(CommunicationLog.lead_id)
        )
        for row in db_session.execute(msg_q):
            latest_msgs[row.lead_id] = {
                "body_preview": row.body_preview,
                "direction": row.direction,
            }

    items = []
    for lead in leads:
        contact = lead.contact if lead.contact else None
        assigned = lead.assigned_user if lead.assigned_user else None
        msg = latest_msgs.get(lead.id, {})
        items.append({
            "id": str(lead.id),
            "ref_number": lead.ref_number,
            "address": contact.address_loss if contact else None,
            "phone": contact.phone_number if contact else None,
            "status": lead.status,
            "assigned_agent": f"{assigned.first_name} {assigned.last_name}" if assigned else None,
            "assigned_to": str(lead.assigned_to) if lead.assigned_to else None,
            "last_message": msg.get("body_preview"),
            "last_message_direction": msg.get("direction"),
            "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if total else 0,
    }


@router.get(
    "/{lead_id}",
    summary="Read Lead By Id",
    response_description="Lead data",
    response_model=schemas.Lead,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_lead_by_id(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a lead by an id."""

    # Get a lead or raise an exception
    lead = crud_util.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    return lead


@router.post(
    "",
    summary="Create Lead",
    response_description="Lead created",
    response_model=schemas.Lead,
    responses=response_manager.get_lead_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ],
        additional_codes=response_manager.not_found_response(),
    ),
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_lead(
    lead_in: schemas.LeadCreate,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Creates a new lead entity in the database."""

    # Set the current user context for tracking
    UserContext.set(current_user.id)

    # Retrieve the lead service from the service locator
    lead_service = service_locator.get_lead_service()

    # Call the lead service to create the new lead
    return lead_service.create_lead(lead_in, current_user)


@router.put(
    "/{lead_id}",
    summary="Update Lead",
    response_description="Updated lead data",
    response_model=schemas.Lead,
    responses=response_manager.get_lead_responses(
        include_status_codes=[
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ],
        additional_codes=response_manager.not_found_response(),
    ),
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_lead(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    lead_in: schemas.LeadUpdate,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Updates an existing lead entity in the database."""

    # Set the current user context for tracking
    UserContext.set(current_user.id)

    # Retrieve the lead service from the service locator
    lead_service = service_locator.get_lead_service()

    # Call the lead service to update the lead with the provided ID and data
    return lead_service.update_lead(lead_id, lead_in, current_user)


@router.delete(
    "/{lead_id}",
    summary="Remove Lead",
    response_description="Lead removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_lead(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a lead by providing an ID."""

    # Get a lead or raise an exception
    lead = crud_util.get_object_or_raise_exception(db_session, object_id=lead_id)

    # Validate lead ownership
    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    crud.lead.remove(db_session, obj_id=lead_id)

    return {"msg": "Lead deleted successfully."}


@router.post(
    "/{lead_id}/convert",
    summary="Convert Lead to Client + Claim",
    response_description="Created claim data",
    dependencies=[
        Depends(permissions.update()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def convert_lead(
    lead_id: Annotated[UUID, Path(description="The lead ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.LeadConvertRequest | None = None,
) -> Any:
    """Convert a signed lead into a client and claim."""
    from fastapi import HTTPException

    # Set user context for audit trail
    UserContext.set(current_user.id)

    # Fetch lead within the active session
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    validate_lead_ownership(
        user=current_user,
        lead_obj=lead,
        exception_msg="This lead does not belong to you.",
    )

    # Prevent double conversion
    if lead.client_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lead has already been converted to a client.",
        )

    req = body or schemas.LeadConvertRequest()

    outcome_svc = LeadOutcomeService(db_session)
    outcome_svc._automation_convert_to_claim(
        lead=lead,
        current_user=current_user,
        contract_sign_date=req.contract_sign_date,
        fee_type_override=req.fee_type,
        fee_override=req.fee,
    )

    # Re-fetch to get updated client_id
    updated_lead = crud.lead.get(db_session, obj_id=lead_id)

    return {
        "msg": "Lead converted successfully.",
        "client_id": str(updated_lead.client_id) if updated_lead and updated_lead.client_id else None,
        "lead_id": str(lead_id),
    }
