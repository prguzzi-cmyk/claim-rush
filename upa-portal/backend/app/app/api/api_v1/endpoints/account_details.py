# !/usr/bin/env python

"""Routes for the Account module"""
import uuid
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, status, Path, HTTPException, Body
from fastapi_pagination import Params
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_db_session, get_current_active_user
from app.core.rbac import Modules
from app.models.account_detail import AccountDetail
from app.models.cart import Cart
from app.schemas import AccountCreatedRequest, AccountUpdatedRequest
from app.schemas.account_detail import AccountDetailCreatedRequest
from app.schemas.cart import CartCreatedRequest, CartUpdatedRequest
from app.utils.contexts import UserContext
from app.utils.pagination import CustomPage
from app.utils.sql_stmt_generator import SqlStmtGenerator

router = APIRouter()
permissions = Permissions(Modules.SHOP_MANAGEMENT.value)
stmt_gen = SqlStmtGenerator(AccountDetail)


@router.get(
    "/{account_id}/detail",
    summary="Read Credit List",
    response_description="A list of credit for a specical account",
    response_model=CustomPage[schemas.account_detail.AccountDetailBase],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.read())
    ]
)
def get_account_detail_list(
        account_id: Annotated[UUID, Path(title='account id')],
        db_session: Annotated[Session, Depends(get_db_session)],
        params: Params = Depends(),
) -> Any:
    """get account detail list"""
    return crud.account_detail.get_account_detail_list_by_account_id(db_session, params, account_id=account_id)
