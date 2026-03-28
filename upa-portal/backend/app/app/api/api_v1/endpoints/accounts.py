# !/usr/bin/env python

"""Routes for the Account module"""
import uuid
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, status, Path, HTTPException, Body
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
    "/me",
    summary="Read My Account",
    response_description="account of current user",
    response_model=schemas.account.AccountBase,
    status_code=status.HTTP_200_OK,
)
def get_my_account(
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """get account of current user"""

    account = crud.account.get_my_account(db_session, current_user.id)
    return schemas.account.AccountBase.from_orm(account)


@router.get(
    "",
    summary="Read Account List",
    response_description="A list of account",
    response_model=CustomPage[schemas.account.AccountBase],
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.read())
    ]
)
def get_account_list(
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """get account list"""
    account = crud.account.get_account_list(db_session)
    return account


@router.post(
    "",
    summary="deposit or withdraw the credit for a special user",
    response_description="Credit updated",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(permissions.create())
    ]
)
def create_credit(
        email: Annotated[EmailStr, Body(title='user email')],
        amount: Annotated[Decimal, Body(title='deposit or withdraw credit amount')],
        summary: Annotated[str, Body(title='the summary of operation')],
        db_session: Annotated[Session, Depends(get_db_session)],
        current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """deposit or withdraw the credit for a special user"""

    UserContext.set(current_user.id)

    user = crud.user.get_by_email(db_session, email=email)
    if user is None:
        return {'msg': 'No user found. please check email'}

    account = crud.account.get_account_by_user_id(db_session, user.id)
    if account is None:
        account_id = uuid.uuid4()
        crud.account.create(db_session,
                            obj_in=AccountCreatedRequest(
                                **{'id': account_id, 'user_id': user.id, 'account_balance': amount}))
        crud.account_detail.create(db_session, obj_in=AccountDetailCreatedRequest(
            **{'account_id': account_id, 'amount': amount, 'summary': summary}))
    else:
        crud.account.update(db_session, db_obj=account, obj_in=AccountUpdatedRequest(
            **{'id': account.id, 'account_balance': account.account_balance + amount}))
        crud.account_detail.create(db_session, obj_in=AccountDetailCreatedRequest(
            **{'account_id': account.id, 'amount': amount, 'summary': summary}))
    return {'msg': 'Ok'}


@router.post(
    "/credit-distribution",
    summary="Endpoint for system requirements credit distribution",
    response_description="Credit updated",
    response_model=schemas.Msg,
    status_code=status.HTTP_200_OK,
)
def create_credit_for_distribution(
        user_id: Annotated[UUID, Body(title='user id')],
        amount: Annotated[Decimal, Body(title='deposit or withdraw credit amount')],
        summary: Annotated[str, Body(title='the summary of operation')],
        db_session: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Endpoint for system requirements credit distribution"""
    user = crud.user.get(db_session, obj_id=user_id)
    if user is None:
        return {'msg': 'No user found. please check email'}

    account = crud.account.get_account_by_user_id(db_session, user.id)
    if account is None:
        account_id = uuid.uuid4()
        crud.account.create(db_session,
                            obj_in=AccountCreatedRequest(
                                **{'id': account_id, 'user_id': user.id, 'account_balance': amount}))
        crud.account_detail.create(db_session, obj_in=AccountDetailCreatedRequest(
            **{'account_id': account_id, 'amount': amount, 'summary': summary}))
    else:
        crud.account.update(db_session, db_obj=account, obj_in=AccountUpdatedRequest(
            **{'id': account.id, 'account_balance': account.account_balance + amount}))
        crud.account_detail.create(db_session, obj_in=AccountDetailCreatedRequest(
            **{'account_id': account.id, 'amount': amount, 'summary': summary}))
    return {'msg': 'Ok'}
