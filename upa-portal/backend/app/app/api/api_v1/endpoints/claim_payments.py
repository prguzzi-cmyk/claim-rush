#!/usr/bin/env python

"""Routes for the Claim Payments module"""

from datetime import date
from functools import partial
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import (
    Permissions,
    get_current_active_user,
    get_db_session,
    at_least_admin_user,
)
from app.api.deps.app import CommonReadParams
from app.core.enums import ClaimActivityType, ClaimPaymentExpenseTypes, ClaimPaymentIncomeTypes
from app.core.rbac import Modules, Operations
from app.core.read_params_attrs import ClaimPaymentSort, Ordering
from app.repositories import ClaimPaymentRepository
from app.services import ClaimPaymentService
from app.utils.claim import validate_claim_ownership, validate_claim_role
from app.utils.common import slug_to_capital_case
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.models.estimate_project import EstimateProject
from app.models.carrier_comparison import CarrierComparison
from app.utils.sql_stmt_generator import ClaimSqlStmtGenerator

router = APIRouter()

module = Modules.CLAIM_PAYMENT
permissions = Permissions(module.value)
claim_role_permissions = partial(validate_claim_role, module=module)
crud_util = CrudUtil(crud.claim_payment)
crud_util_claim = CrudUtil(crud.claim)
read_params = CommonReadParams(search_enum=None, sort_enum=ClaimPaymentSort)
stmt_gen = ClaimSqlStmtGenerator(models.ClaimPayment)
resource_exc_msg = "You do not have permission to modify this claim payment."


@router.get(
    "/{claim_id}/payments",
    summary="Read Claim Payments",
    response_description="Claim payments",
    response_model=CustomPage[schemas.ClaimPayment],
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_payments(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    sort_by: read_params.sort_by() = ClaimPaymentSort.created_at,
    order_by: read_params.order_by() = Ordering.desc,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a list of claim payments."""

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    # Apply filter if there is any
    filters_stmt = [
        models.ClaimPayment.claim_id == claim_id,
    ]

    # Apply order by if there is any
    orderby_stmt = stmt_gen.orderby_stmt(sort_by, order_by)

    return crud.claim_payment.get_multi(
        db_session,
        filters=filters_stmt,
        order_by=orderby_stmt,
    )


@router.get(
    "/{claim_id}/payment-summary",
    summary="Get Claim Payment Summary",
    response_description="Payment summary with totals",
    response_model=schemas.ClaimPaymentSummary,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def get_claim_payment_summary(
    *,
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve payment summary totals for a claim."""

    from sqlalchemy import select, func

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    aci_estimate_total = 0.0
    carrier_estimate_total = 0.0

    with db_session as session:
        # Find EstimateProject(s) for this claim and get latest CarrierComparison
        project_stmt = (
            select(EstimateProject)
            .where(EstimateProject.claim_id == claim_id)
        )
        projects = list(session.scalars(project_stmt).unique().all())

        for project in projects:
            comparison_stmt = (
                select(CarrierComparison)
                .where(CarrierComparison.project_id == project.id)
                .order_by(CarrierComparison.created_at.desc())
                .limit(1)
            )
            comparison = session.scalar(comparison_stmt)
            if comparison:
                aci_estimate_total += comparison.aci_total or 0
                carrier_estimate_total += comparison.carrier_total or 0

        # Sum all ClaimPayment amounts for this claim
        total_paid_stmt = (
            select(func.coalesce(func.sum(models.ClaimPayment.check_amount), 0))
            .where(models.ClaimPayment.claim_id == claim_id)
        )
        total_paid = float(session.scalar(total_paid_stmt))

    remaining_recoverable = max(0, aci_estimate_total - total_paid)

    return schemas.ClaimPaymentSummary(
        aci_estimate_total=round(aci_estimate_total, 2),
        carrier_estimate_total=round(carrier_estimate_total, 2),
        total_paid=round(total_paid, 2),
        remaining_recoverable=round(remaining_recoverable, 2),
    )


@router.get(
    "/payments/ready-to-process",
    summary="Claim Payments Ready to Process",
    response_description="Claim payments",
    response_model=CustomPage[schemas.ClaimPaymentPayout],
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.read()),
    ],
)
def get_claim_payments_ready_to_process(
    *,
    until_date: Annotated[
        date,
        Query(
            title="Until Date",
            description="Specify the cutoff date for payments that are ready to be processed.",
        ),
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Retrieve a list of claim payments that are ready to process for payouts."""

    repository = ClaimPaymentRepository(db_session)
    service = ClaimPaymentService(repository)
    claim_payments = service.fetch_claim_payments_ready_to_process(until_date)

    return claim_payments


@router.get(
    "/payments/income-types",
    summary="Read Income Types",
    response_description="A list of income types",
    response_model=list[schemas.Enumerator],
    dependencies=[
        Depends(permissions.read()),
    ],
    deprecated=True,
)
def read_income_types() -> Any:
    """Retrieve all income types."""

    income_types = []

    for income in ClaimPaymentIncomeTypes:
        income_types.append(
            {
                "display_name": slug_to_capital_case(income.value),
                "value": income.value,
            }
        )

    return income_types


@router.get(
    "/payments/expense-types",
    summary="Read Expense Types",
    response_description="A list of expense types",
    response_model=list[schemas.Enumerator],
    dependencies=[
        Depends(permissions.read()),
    ],
    deprecated=True,
)
def read_expense_types() -> Any:
    """Retrieve all expense types."""

    expense_types = []

    for expense in ClaimPaymentExpenseTypes:
        expense_types.append(
            {
                "display_name": slug_to_capital_case(expense.value),
                "value": expense.value,
            }
        )

    return expense_types


@router.get(
    "/payments/{claim_payment_id}",
    summary="Read Claim Payment By Id",
    response_description="Claim payment data",
    response_model=schemas.ClaimPayment,
    dependencies=[
        Depends(permissions.read()),
    ],
)
def read_claim_payment_by_id(
    claim_payment_id: Annotated[UUID, Path(description="Claim payment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a claim payment by an id."""

    # Get a claim payment or raise an exception
    claim_payment = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_payment.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
    )

    return claim_payment


@router.post(
    "/{claim_id}/payments",
    summary="Create Claim Payment",
    response_description="Claim Payment created",
    response_model=schemas.ClaimPayment,
    dependencies=[
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_201_CREATED,
)
def create_claim_payment(
    claim_id: Annotated[UUID, Path(description="The claim ID.")],
    payment_in: schemas.ClaimPaymentCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new claim payment."""

    UserContext.set(current_user.id)

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.CREATE,
    )

    # Create a payment record in the database
    claim_payment_in = schemas.ClaimPaymentCreateDB(
        payment_date=payment_in.payment_date,
        check_amount=payment_in.check_amount,
        check_type=payment_in.check_type,
        ref_number=payment_in.ref_number,
        payment_type=payment_in.payment_type,
        issued_by=payment_in.issued_by,
        payee=payment_in.payee,
        deposit_status=payment_in.deposit_status,
        related_coverage=payment_in.related_coverage,
        note=payment_in.note,
        contingency_fee_percentage=payment_in.contingency_fee_percentage,
        appraisal_fee=payment_in.appraisal_fee,
        umpire_fee=payment_in.umpire_fee,
        mold_fee=payment_in.mold_fee,
        misc_fee=payment_in.misc_fee,
        claim_id=claim_id,
    )

    payment_obj = crud.claim_payment.create(db_session, obj_in=claim_payment_in)

    crud.claim.create_activity(
        db_session, claim, ClaimActivityType.PAYMENT_ISSUED,
        extra_details=f"Payment: ${payment_in.check_amount} ({payment_in.payment_type or 'N/A'})"
    )

    return payment_obj


@router.post(
    "/payments/lock-payments",
    summary="Lock Claim Payments",
    dependencies=[
        Depends(at_least_admin_user()),
        Depends(permissions.create()),
    ],
    status_code=status.HTTP_204_NO_CONTENT,
)
def lock_claim_payment(
    payment_ids_in: schemas.LockClaimPayments,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> None:
    """Lock claim payments that are processed for the payout."""

    repository = ClaimPaymentRepository(db_session)
    service = ClaimPaymentService(repository)
    service.lock_payments(payment_ids_in.payment_ids)

    return None


@router.put(
    "/payments/{claim_payment_id}",
    summary="Update Claim Payment",
    response_description="Updated claim payment",
    response_model=schemas.ClaimPayment,
    dependencies=[
        Depends(permissions.update()),
    ],
)
def update_claim_payment(
    claim_payment_id: Annotated[UUID, Path(description="Claim payment ID.")],
    claim_payment_in: schemas.ClaimPaymentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update a claim payment via an ID."""

    UserContext.set(current_user.id)

    # Get a claim payment or raise an exception
    claim_payment = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_payment.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
        user=current_user,
        claim_obj=claim,
        exception_msg="This claim does not belong to you.",
    )

    # Validate claim role
    claim_role_permissions(
        db_session=db_session,
        user=current_user,
        claim=claim,
        operation=Operations.UPDATE,
        resource=claim_payment,
        resource_exc_msg=resource_exc_msg,
    )

    claim_payment = crud.claim_payment.update(
        db_session, db_obj=claim_payment, obj_in=claim_payment_in
    )

    crud.claim.create_activity(
        db_session, claim, ClaimActivityType.PAYMENT_UPDATED,
        extra_details=f"Payment updated: ${claim_payment_in.check_amount or ''}"
    )

    return claim_payment


@router.delete(
    "/payments/{claim_payment_id}",
    summary="Remove Claim Payment",
    response_description="Claim Payment removed",
    response_model=schemas.Msg,
    dependencies=[
        Depends(permissions.remove()),
    ],
)
def remove_claim_payment(
    claim_payment_id: Annotated[UUID, Path(description="Claim payment ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Remove a claim payment by providing an ID."""

    # Get a claim payment or raise an exception
    claim_payment_obj = crud_util.get_object_or_raise_exception(
        db_session, object_id=claim_payment_id
    )

    # Get a claim or raise an exception
    claim = crud_util_claim.get_object_or_raise_exception(
        db_session, object_id=claim_payment_obj.claim_id
    )

    # Validate claim ownership
    validate_claim_ownership(
        db_session,
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
        resource=claim_payment_obj,
        resource_exc_msg=resource_exc_msg,
    )

    crud.claim_payment.hard_remove(db_session, obj_id=claim_payment_id)

    return {"msg": "Payment deleted successfully."}
