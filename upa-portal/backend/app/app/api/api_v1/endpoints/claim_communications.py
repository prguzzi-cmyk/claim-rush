#!/usr/bin/env python

"""Routes for the Claim Communications Hub — Carrier Messages, Client Messages, Internal Notes"""

from functools import partial
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.enums import ClaimActivityType
from app.core.rbac import Modules, Operations
from app.models.claim_communication import ClaimCommunication
from app.schemas.claim_communication import (
    ClaimCommunicationCreate,
    ClaimCommunicationCreateDB,
    ClaimCommunicationSummary,
    ClaimCommunication as ClaimCommunicationSchema,
)
from app.utils.claim import validate_claim_ownership, validate_claim_role
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil

router = APIRouter()

module = Modules.CLAIM_COMMUNICATION
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util_claim = CrudUtil(crud.claim)

VALID_MESSAGE_TYPES = {"carrier", "client", "internal"}

# Map message_type → ClaimActivityType
ACTIVITY_TYPE_MAP = {
    "carrier": ClaimActivityType.CARRIER_MESSAGE_SENT,
    "client": ClaimActivityType.CLIENT_MESSAGE_SENT,
    "internal": ClaimActivityType.INTERNAL_NOTE_ADDED,
}


@router.get(
    "/{claim_id}/communications",
    summary="List Claim Communications",
    response_description="Claim communications",
    response_model=list[ClaimCommunicationSchema],
    dependencies=[Depends(permissions.read())],
)
def read_claim_communications(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    message_type: Annotated[
        str | None,
        Query(description="Filter by message_type: carrier, client, or internal."),
    ] = None,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve claim communications, optionally filtered by message_type."""

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    # Security: clients cannot see carrier messages or internal notes
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "client":
        # Clients can only see client messages
        if message_type and message_type != "client":
            return []
        message_type = "client"
    elif role_name == "sales-rep":
        # Sales reps cannot see internal notes
        if message_type == "internal":
            return []

    if message_type and message_type in VALID_MESSAGE_TYPES:
        return crud.claim_communication.get_by_claim_and_type(
            db_session, claim_id=claim_id, message_type=message_type
        )

    # Return all types (filtered by role above)
    results = []
    allowed_types = VALID_MESSAGE_TYPES.copy()
    if role_name == "sales-rep":
        allowed_types.discard("internal")

    for mt in allowed_types:
        results.extend(
            crud.claim_communication.get_by_claim_and_type(
                db_session, claim_id=claim_id, message_type=mt
            )
        )

    results.sort(key=lambda x: x.created_at, reverse=True)
    return results


@router.get(
    "/{claim_id}/communications/summary",
    summary="Claim Communications Summary",
    response_description="Communication counts per type",
    response_model=ClaimCommunicationSummary,
    dependencies=[Depends(permissions.read())],
)
def read_claim_communications_summary(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get communication summary counts for a claim."""

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    summary = crud.claim_communication.get_summary(
        db_session, claim_id=claim_id
    )

    # Security: hide counts for restricted types
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "client":
        summary["carrier_count"] = 0
        summary["internal_count"] = 0
        summary["last_carrier_date"] = None
        summary["last_internal_date"] = None
        summary["total_count"] = summary["client_count"]
    elif role_name == "sales-rep":
        summary["internal_count"] = 0
        summary["last_internal_date"] = None
        summary["total_count"] = summary["carrier_count"] + summary["client_count"]

    return summary


@router.post(
    "/{claim_id}/communications",
    summary="Create Claim Communication",
    response_description="Communication created",
    response_model=ClaimCommunicationSchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_claim_communication(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    comm_in: ClaimCommunicationCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new claim communication (carrier message, client message, or internal note)."""

    UserContext.set(current_user.id)

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.CREATE,
    )

    # Security: clients can only create client messages
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "client" and comm_in.message_type != "client":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only send client messages.",
        )

    # Sales reps cannot create internal notes
    if role_name == "sales-rep" and comm_in.message_type == "internal":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales representatives cannot create internal notes.",
        )

    comm_db = ClaimCommunicationCreateDB(
        claim_id=claim_id,
        sender_id=current_user.id,
        message_type=comm_in.message_type,
        subject=comm_in.subject,
        body=comm_in.body,
        recipient_email=comm_in.recipient_email,
        recipient_name=comm_in.recipient_name,
        direction=comm_in.direction,
        channel=comm_in.channel,
        thread_id=comm_in.thread_id,
        attachments_json=comm_in.attachments_json,
        is_system_generated=False,
    )

    comm_obj = crud.claim_communication.create(db_session, obj_in=comm_db)

    # Create activity timeline entry
    activity_type = ACTIVITY_TYPE_MAP.get(
        comm_in.message_type, ClaimActivityType.COMMENT_ADDED
    )
    body_preview = comm_in.body[:80] if comm_in.body else ""
    if comm_in.message_type == "carrier":
        detail = f"Carrier message: {comm_in.subject or body_preview}"
    elif comm_in.message_type == "client":
        detail = f"Client message: {body_preview}"
    else:
        detail = f"Internal note: {body_preview}"

    crud.claim.create_activity(db_session, claim, activity_type, extra_details=detail)

    return comm_obj


@router.get(
    "/communications/{comm_id}",
    summary="Read Communication By Id",
    response_description="Communication data",
    response_model=ClaimCommunicationSchema,
    dependencies=[Depends(permissions.read())],
)
def read_claim_communication_by_id(
    comm_id: Annotated[UUID, Path(description="Communication ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim communication by ID."""

    from app.utils.exceptions import CrudUtil
    crud_util_comm = CrudUtil(crud.claim_communication)

    comm = crud_util_comm.get_object_or_raise_exception(
        db_session, object_id=comm_id
    )

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=comm.claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Security check
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "client" and comm.message_type != "client":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this communication.",
        )
    if role_name == "sales-rep" and comm.message_type == "internal":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to internal notes.",
        )

    return comm


@router.get(
    "/communications/{comm_id}/thread",
    summary="Read Communication Thread",
    response_description="Thread messages",
    response_model=list[ClaimCommunicationSchema],
    dependencies=[Depends(permissions.read())],
)
def read_communication_thread(
    comm_id: Annotated[UUID, Path(description="Root message ID of the thread.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all messages in a thread."""

    from app.utils.exceptions import CrudUtil
    crud_util_comm = CrudUtil(crud.claim_communication)

    root = crud_util_comm.get_object_or_raise_exception(
        db_session, object_id=comm_id
    )

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=root.claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    replies = crud.claim_communication.get_thread(
        db_session, thread_id=comm_id
    )

    # Include root + replies, ordered chronologically
    all_messages = [root] + list(replies)
    return all_messages


@router.delete(
    "/communications/{comm_id}",
    summary="Remove Communication",
    response_description="Communication removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def remove_claim_communication(
    comm_id: Annotated[UUID, Path(description="Communication ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim communication by ID."""

    from app.utils.exceptions import CrudUtil
    crud_util_comm = CrudUtil(crud.claim_communication)

    comm = crud_util_comm.get_object_or_raise_exception(
        db_session, object_id=comm_id
    )

    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=comm.claim_id
    )

    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.REMOVE,
    )

    crud.claim_communication.remove(db_session, obj_id=comm_id)

    return {"msg": "Communication deleted successfully."}
