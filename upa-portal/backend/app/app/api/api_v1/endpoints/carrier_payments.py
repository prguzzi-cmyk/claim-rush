#!/usr/bin/env python

"""Routes for the Carrier Payments module"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.carrier_payment import (
    CarrierPayment,
    CarrierPaymentCreate,
    CarrierPaymentCreateDB,
)
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil

router = APIRouter()

module = Modules.ESTIMATE_PROJECT
permissions = Permissions(module.value)
crud_util_project = CrudUtil(crud.estimate_project)


@router.post(
    "/{project_id}/carrier-payments",
    summary="Record a carrier payment",
    response_description="The created carrier payment",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(permissions.create())],
)
async def create_carrier_payment(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    payment_in: CarrierPaymentCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> CarrierPayment:
    """Create a new carrier payment for a project."""
    UserContext.set(current_user.id)
    # Verify project exists
    crud_util_project.get_object_or_raise_exception(db_session, project_id)

    obj_in = CarrierPaymentCreateDB(
        **payment_in.dict(),
        project_id=project_id,
    )
    payment = crud.carrier_payment.create(db_session=db_session, obj_in=obj_in)
    return payment


@router.get(
    "/{project_id}/carrier-payments",
    summary="List carrier payments for a project",
    response_description="List of carrier payments",
    dependencies=[Depends(permissions.read())],
)
async def list_carrier_payments(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> list[CarrierPayment]:
    """List all carrier payments for a project."""
    return crud.carrier_payment.get_by_project(db_session=db_session, project_id=project_id)


@router.delete(
    "/{project_id}/carrier-payments/{payment_id}",
    summary="Delete a carrier payment",
    response_description="No content",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(permissions.remove())],
)
async def delete_carrier_payment(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    payment_id: Annotated[UUID, Path(description="Carrier payment ID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> None:
    """Delete a carrier payment."""
    payment = crud.carrier_payment.get(db_session=db_session, obj_id=payment_id)
    if not payment or payment.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carrier payment not found.",
        )
    crud.carrier_payment.hard_remove(db_session=db_session, obj_id=payment_id)
