#!/usr/bin/env python

"""Routes for the Claims module"""

from functools import partial
from typing import Annotated, Any, Union
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.api.deps.app import CommonReadParams, RemovedRecQueryParam, get_service_locator
from app.core.enums import ClaimOriginType, ClaimPhases, EscalationPath, ClaimSubStatus, RecoveryMode
from app.core.rbac import Modules, Operations
from app.core.read_params_attrs import ClaimSearch, ClaimSort, Ordering
from app.models import Claim
from app.service_locator import AppServiceLocator
from app.utils.claim import (
    validate_claim_ownership,
    validate_claim_role,
    get_collaborated_claim_list,
    get_claim_specific_role,
)
from app.utils.common import slug_to_capital_case
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import ClaimSqlStmtGenerator
from app.utils.territory_filter import get_claim_territory_filters

router = APIRouter()

module = Modules.CLAIM
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim)
crud_util_user = CrudUtil(crud.user)
crud_util_client = CrudUtil(crud.client)
read_params = CommonReadParams(ClaimSearch, ClaimSort)
stmt_gen = ClaimSqlStmtGenerator(Claim)
resource_exc_msg = "You do not have permission to modify this claim."


@router.get(
    "",
    summary="Read Claims",
    response_description="A list of claims",
    response_model=CustomPage[
        Union[
            schemas.Claim,
            schemas.ClaimCollaborator,
        ]
    ],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claims(
    *,
    search_field: read_params.search_field() = None,
    search_value: read_params.search_value() = None,
    sort_by: read_params.sort_by() = ClaimSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    removed: Annotated[RemovedRecQueryParam, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all claims."""
    from app.models import ClaimContact

    # Apply filter if there is any
    filters_stmt = stmt_gen.filters_stmt(search_field, search_value)

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    # Apply territory-based access filters
    territory_filters = get_claim_territory_filters(db_session, current_user)
    join_targets = stmt_gen.join_stmt()
    if territory_filters:
        if filters_stmt is None:
            filters_stmt = territory_filters
        else:
            filters_stmt.extend(territory_filters)
        # Ensure ClaimContact is joined for territory filtering
        if join_targets is None:
            join_targets = set()
        join_targets.add(ClaimContact)

    if crud.user.has_admin_privileges(current_user):
        claims_list = crud.claim.get_multi(
            db_session,
            join_target=join_targets,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
    elif current_user.role and current_user.role.name == "client":
        # Client users only see claims linked to their client record
        claims_list = crud.claim.get_by_client_owner(
            db_session,
            user_id=current_user.id,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
        claims_list = get_collaborated_claim_list(
            claims_list=claims_list, user=current_user
        )
    else:
        claims_list = crud.claim.get_assigned(
            db_session,
            users=crud.user.get_subordinate_ids(db_session, current_user.id),
            join_target=join_targets,
            is_outer=True,
            filters=filters_stmt,
            order_by=orderby_stmt,
            removed=removed.only_removed,
        )
        claims_list = get_collaborated_claim_list(
            claims_list=claims_list, user=current_user
        )

    return claims_list


@router.get(
    "/claim-phases",
    summary="Read Claim Phases",
    response_description="A list of claim phases",
    response_model=list[schemas.ClaimPhase],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_phases() -> Any:
    """Retrieve all claim phases."""

    claim_phases = []

    for phase in ClaimPhases:
        claim_phases.append(
            {
                "display_name": slug_to_capital_case(phase.value),
                "slug": phase.value,
            }
        )

    return claim_phases


@router.get(
    "/escalation-paths",
    summary="Read Escalation Paths",
    response_description="A list of escalation paths",
    response_model=list[schemas.ClaimEscalationPath],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_escalation_paths() -> Any:
    """Retrieve all escalation paths."""
    return [
        {"display_name": slug_to_capital_case(e.value), "slug": e.value}
        for e in EscalationPath
    ]


@router.get(
    "/sub-statuses",
    summary="Read Sub-Statuses",
    response_description="A list of sub-statuses",
    response_model=list[schemas.ClaimSubStatusOption],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_sub_statuses() -> Any:
    """Retrieve all sub-statuses."""
    return [
        {"display_name": slug_to_capital_case(s.value), "slug": s.value}
        for s in ClaimSubStatus
    ]


@router.get(
    "/origin-types",
    summary="Read Origin Types",
    response_description="A list of claim origin types",
    response_model=list[schemas.ClaimOriginTypeOption],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_origin_types() -> Any:
    """Retrieve all claim origin types."""
    return [
        {"display_name": slug_to_capital_case(e.value), "slug": e.value}
        for e in ClaimOriginType
    ]


@router.get(
    "/recovery-modes",
    summary="Read Recovery Modes",
    response_description="A list of recovery modes",
    response_model=list[schemas.RecoveryModeOption],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_recovery_modes() -> Any:
    """Retrieve all recovery modes."""
    return [
        {"display_name": slug_to_capital_case(e.value), "slug": e.value}
        for e in RecoveryMode
    ]


@router.get(
    "/{claim_id}",
    summary="Read Claim By Id",
    response_description="Claim data",
    response_model=schemas.ClaimDetailed | schemas.ClaimDetailedCollaborator,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_by_id(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieves a claim entity from the database by its unique ID."""

    claim_service = service_locator.get_claim_service()

    claim_entity = claim_service.get_claim_by_id(claim_id, user=current_user)

    # Get a total of payments by their type
    total = crud.claim_payment.get_sum(
        db_session, filters=[models.ClaimPayment.claim_id == claim_id]
    )

    # TODO: Move below logic to appropriate service method

    # Check if the user is a collaborator or a restricted role (sales-rep, client)
    is_restricted = (
        crud.claim.is_collaborator(user=current_user, claim_obj=claim_entity)
        or (current_user.role and current_user.role.name in ("sales-rep", "client"))
    )
    if is_restricted:
        claim_dict: dict = claim_entity.__dict__

        # Add Claim role to the response
        claim_dict["claim_role"] = get_claim_specific_role(
            user=current_user, claim_obj=claim_entity
        )

        claim = schemas.ClaimDetailedCollaborator(**claim_dict)

        # Check if user is a source collaborator or client — hide payment totals
        if crud.claim.is_source(user=current_user, claim_obj=claim_entity):
            total = None
        if current_user.role and current_user.role.name == "client":
            total = None
    else:
        claim = schemas.ClaimDetailed(**claim_entity.__dict__)

    if total:
        claim.payments_sum = total

    return claim


@router.get(
    "/{claim_id}/timeline",
    summary="Read Claim Timeline",
    response_description="Claim timeline data",
    response_model=CustomPage[schemas.ClaimActivity],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_timeline(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim timeline."""

    claim_service = service_locator.get_claim_service()

    claim_service.get_claim_by_id(claim_id, user=current_user)

    timeline = crud.claim_activity.get_multi(
        db_session=db_session,
        filters=[models.ClaimActivity.claim_id == claim_id],
        order_by=[models.ClaimActivity.created_at.desc()],
    )
    return timeline


@router.post(
    "",
    summary="Create Claim",
    response_description="Claim created",
    response_model=schemas.Claim,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_claim(
    claim_in: schemas.ClaimCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new claim."""

    # Check if the source user exists
    if claim_in.source:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.source,
            err_msg="Source user ID not found.",
        )

    # Check if the Signed user exists
    if claim_in.signed_by:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.signed_by,
            err_msg="Signed user ID not found.",
        )

    # Check if the Adjusted by user exists
    if claim_in.adjusted_by:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.adjusted_by,
            err_msg="Adjusted by user ID not found.",
        )

    # Check if the assigned user exists
    crud_util_user.get_object_or_raise_exception(
        db_session,
        object_id=claim_in.assigned_to,
        err_msg="Assigned user ID not found.",
    )

    # Check if the client exists
    crud_util_client.get_object_or_raise_exception(
        db_session,
        object_id=claim_in.client_id,
        err_msg="Provided client ID not found.",
    )

    UserContext.set(current_user.id)

    # Validate claim ownership
    validate_claim_ownership(
        db_session=db_session,
        user=current_user,
        claim_obj=claim_in,
        exception_msg="You are not allowed to assign this claim to someone else.",
    )

    claim = crud.claim.create(db_session, obj_in=claim_in)

    return claim


@router.post(
    "/{claim_id}/append-collaborators",
    summary="Append Collaborators",
    response_description="Collaborators appended",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def append_collaborators(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    data_in: schemas.CollaboratorAppend,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Append Collaborators to a claim."""

    claim_service = service_locator.get_claim_service()

    claim_service.get_claim_by_id(claim_id, user=current_user)

    collaborator_objs = crud.user.get_objects_by_ids(
        db_session, user_ids=data_in.collaborator_ids
    )

    crud.claim.append_collaborators(
        db_session, claim_id=claim_id, collaborators=collaborator_objs
    )

    return {"msg": "Successfully appended collaborators to the claim."}


@router.post(
    "/{claim_id}/remove-collaborators",
    summary="Remove Collaborators",
    response_description="Collaborators removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def remove_collaborators(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    data_in: schemas.CollaboratorRemove,
    service_locator: Annotated[AppServiceLocator, Depends(get_service_locator)],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove Collaborators from a claim."""

    claim_service = service_locator.get_claim_service()

    claim_service.get_claim_by_id(claim_id, user=current_user)

    collaborator_objs = crud.user.get_objects_by_ids(
        db_session, user_ids=data_in.collaborator_ids
    )

    crud.claim.remove_collaborators(
        db_session, claim_id=claim_id, collaborators=collaborator_objs
    )

    return {"msg": "Successfully removed collaborators from the claim."}


@router.put(
    "/{claim_id}",
    summary="Update Claim",
    response_description="Updated claim data",
    response_model=schemas.Claim,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    claim_in: schemas.ClaimUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim via an ID."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util.get_object_or_raise_exception(db_session, object_id=claim_id)

    # Validate claim ownership
    validate_claim_ownership(
        db_session=db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="You are not allowed to update records of this claim.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.UPDATE,
    )

    # Check if the source user exists
    if claim_in.source:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.source,
            err_msg="Source user ID not found.",
        )

    # Check if the Signed user exists
    if claim_in.signed_by:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.signed_by,
            err_msg="Signed user ID not found.",
        )

    # Check if the Adjusted by user exists
    if claim_in.adjusted_by:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.adjusted_by,
            err_msg="Adjusted by user ID not found.",
        )

    # Check if the assigned user exists
    if claim_in.assigned_to:
        crud_util_user.get_object_or_raise_exception(
            db_session,
            object_id=claim_in.assigned_to,
            err_msg="Assigned user ID not found.",
        )

    # Validate the incoming claim status
    # validate_incoming_claim_status(user=current_user, obj_in=claim_in)

    claim = crud.claim.update(db_session, db_obj=claim, obj_in=claim_in)

    return claim


@router.patch(
    "/{claim_id}/restore",
    summary="Restore Claim",
    response_description="Restored Claim data",
    response_model=schemas.Claim,
    dependencies=[
        Depends(permissions.restore()),
    ],
)
def restore_claim(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Restore a claim via an ID."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util.get_removed_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.RESTORE,
    )

    claim = crud.claim.restore(db_session, db_obj=claim)

    return claim


@router.delete(
    "/{claim_id}",
    summary="Remove Claim",
    response_description="Claim removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim by providing an ID."""

    # Get a claim or raise an exception
    claim = crud_util.get_object_or_raise_exception(db_session, object_id=claim_id)

    # Validate claim ownership
    validate_claim_ownership(
        db_session=db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        claim=claim,
        user=current_user,
        operation=Operations.REMOVE,
    )

    crud.claim.remove(db_session, obj_id=claim_id)

    return {"msg": "Claim deleted successfully."}
