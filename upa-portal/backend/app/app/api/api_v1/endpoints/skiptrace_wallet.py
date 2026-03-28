#!/usr/bin/env python

"""Routes for the Skip Trace Wallet module"""

import json
from datetime import datetime, timezone
from typing import Annotated, Any, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import get_db_session, get_current_active_user
from app.models.lead_owner_intelligence import LeadOwnerIntelligence
from app.schemas.lead_owner_intelligence import (
    LeadOwnerIntelligence as LeadOwnerIntelligenceSchema,
    LeadOwnerIntelligenceCreate,
)
from app.schemas.skiptrace_transaction import (
    SkiptraceTransaction as SkiptraceTransactionSchema,
    SkiptraceTransactionCreate,
)
from app.schemas.skiptrace_wallet import (
    AdminBillingOverview,
    AdminUserBilling,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    SkiptraceWalletSummary,
)
from app.utils.skip_trace import skip_trace_address

router = APIRouter()

CREDIT_PACKS = {
    50: 2500,    # $25.00
    100: 4500,   # $45.00
    250: 10000,  # $100.00
    1000: 35000, # $350.00
}

# Cost per action in credits
ACTION_COSTS = {
    "skip_trace": 1,
    "sms": 1,
    "ai_voice_call": 5,
    "enrichment": 2,
}

# Estimated cost per credit in cents (blended average $0.45/credit)
COST_PER_CREDIT_CENTS = 45


@router.get(
    "/balance",
    summary="Get Skip Trace Wallet Balance",
    response_description="Wallet summary with balance and usage",
    response_model=SkiptraceWalletSummary,
    status_code=status.HTTP_200_OK,
)
def get_wallet_balance(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the current user's skip trace wallet summary."""
    is_admin = crud.user.has_admin_privileges(current_user)
    wallet = crud.skiptrace_wallet.get_or_create_for_user(db_session, current_user.id)

    now = datetime.now(timezone.utc)
    credits_this_month = crud.skiptrace_transaction.get_credits_used_this_month(
        db_session, wallet.id, now.year, now.month
    )

    return SkiptraceWalletSummary(
        credit_balance=wallet.credit_balance,
        credits_used_total=wallet.credits_used,
        credits_used_this_month=credits_this_month,
        is_unlimited=is_admin,
    )


@router.post(
    "/purchase",
    summary="Purchase Skip Trace Credits",
    response_description="Purchase confirmation with placeholder Stripe URL",
    response_model=CreditPurchaseResponse,
    status_code=status.HTTP_200_OK,
)
def purchase_credits(
    body: CreditPurchaseRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Purchase a credit pack for skip trace lookups."""
    if body.pack_size not in CREDIT_PACKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid pack size. Choose from: {list(CREDIT_PACKS.keys())}",
        )

    wallet = crud.skiptrace_wallet.get_or_create_for_user(db_session, current_user.id)
    wallet = crud.skiptrace_wallet.add_credits(db_session, wallet, body.pack_size)

    price_cents = CREDIT_PACKS[body.pack_size]
    placeholder_url = (
        f"https://checkout.stripe.com/placeholder?"
        f"credits={body.pack_size}&amount={price_cents}"
    )

    return CreditPurchaseResponse(
        new_balance=wallet.credit_balance,
        credits_added=body.pack_size,
        stripe_checkout_url=placeholder_url,
    )


@router.get(
    "/transactions",
    summary="List Skip Trace Transactions",
    response_description="Transaction history for the current user",
    response_model=list[SkiptraceTransactionSchema],
    status_code=status.HTTP_200_OK,
)
def list_transactions(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get all skip trace transactions for the current user."""
    wallet = crud.skiptrace_wallet.get_or_create_for_user(db_session, current_user.id)
    return crud.skiptrace_transaction.get_by_wallet_id(db_session, wallet.id)


@router.post(
    "/leads/{lead_id}/run",
    summary="Run Skip Trace on a Lead",
    response_description="Owner intelligence results",
    response_model=LeadOwnerIntelligenceSchema,
    status_code=status.HTTP_200_OK,
)
def run_skip_trace(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Execute a skip trace lookup on a lead and store owner intelligence."""
    # 1. Get lead
    lead = crud.lead.get(db_session, obj_id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    # 2. Check existing owner intelligence
    existing = crud.lead_owner_intelligence.get_by_lead_id(db_session, lead_id)
    if existing and existing.lookup_status == "success":
        return existing

    # 3. Check admin privileges
    is_admin = crud.user.has_admin_privileges(current_user)

    # 4. Get/create wallet
    wallet = crud.skiptrace_wallet.get_or_create_for_user(db_session, current_user.id)

    # 5. Check balance for non-admins
    if not is_admin and wallet.credit_balance < 1:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please purchase a credit pack.",
        )

    # 6. Deduct credit for non-admins
    if not is_admin:
        wallet = crud.skiptrace_wallet.deduct_credit(db_session, wallet)

    # 7. Build address from lead contact
    contact = lead.contact
    if contact:
        # Prefer loss address, fallback to regular address
        street = contact.address_loss or contact.address or ""
        city = contact.city_loss or contact.city or ""
        state = contact.state_loss or contact.state or ""
        zip_code = contact.zip_code_loss or contact.zip_code or ""
        full_address = f"{street}, {city}, {state} {zip_code}".strip(", ")
    else:
        full_address = ""

    if not full_address or full_address.strip(", ") == "":
        # Create failed record
        intel_data = LeadOwnerIntelligenceCreate(
            lead_id=lead_id,
            lookup_status="failed",
        )
        with db_session as session:
            if existing:
                for field_name, value in intel_data.dict(exclude_unset=True).items():
                    if field_name != "lead_id":
                        setattr(existing, field_name, value)
                session.add(existing)
                session.commit()
                session.refresh(existing)
                intel_obj = existing
            else:
                intel_obj = LeadOwnerIntelligence(**intel_data.dict())
                session.add(intel_obj)
                session.commit()
                session.refresh(intel_obj)

        # Record transaction
        txn_data = SkiptraceTransactionCreate(
            wallet_id=wallet.id,
            lead_id=lead_id,
            credits_used=0 if is_admin else 1,
            lookup_status="failed",
            address_queried=full_address or None,
        )
        crud.skiptrace_transaction.create(db_session, obj_in=txn_data)

        return intel_obj

    # 8. Call skip_trace_address
    result = skip_trace_address(full_address)

    # 9. Parse results
    if result and result.residents:
        resident = result.residents[0]
        name_parts = resident.full_name.split(None, 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        lookup_status = "success"
        intel_data = LeadOwnerIntelligenceCreate(
            lead_id=lead_id,
            owner_first_name=first_name,
            owner_last_name=last_name,
            owner_email=resident.emails[0] if resident.emails else None,
            owner_phone=resident.phone_numbers[0] if resident.phone_numbers else None,
            owner_mailing_street=contact.address if contact else None,
            owner_mailing_city=contact.city if contact else None,
            owner_mailing_state=contact.state if contact else None,
            owner_mailing_zip=contact.zip_code if contact else None,
            raw_residents=json.dumps(
                [
                    {
                        "full_name": r.full_name,
                        "phone_numbers": r.phone_numbers,
                        "emails": r.emails,
                        "age": r.age,
                    }
                    for r in result.residents
                ]
            ),
            lookup_status=lookup_status,
        )
    else:
        lookup_status = "no_results"
        intel_data = LeadOwnerIntelligenceCreate(
            lead_id=lead_id,
            lookup_status=lookup_status,
        )

    # 10. Create/update LeadOwnerIntelligence record
    with db_session as session:
        if existing:
            for field_name, value in intel_data.dict(exclude_unset=True).items():
                if field_name != "lead_id":
                    setattr(existing, field_name, value)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            intel_obj = existing
        else:
            intel_obj = LeadOwnerIntelligence(**intel_data.dict())
            session.add(intel_obj)
            session.commit()
            session.refresh(intel_obj)

    # 11. Create SkiptraceTransaction record
    txn_data = SkiptraceTransactionCreate(
        wallet_id=wallet.id,
        lead_id=lead_id,
        credits_used=0 if is_admin else 1,
        lookup_status=lookup_status,
        address_queried=full_address,
    )
    crud.skiptrace_transaction.create(db_session, obj_in=txn_data)

    return intel_obj


@router.get(
    "/leads/{lead_id}/owner-intelligence",
    summary="Get Owner Intelligence for a Lead",
    response_description="Existing owner intelligence data",
    response_model=LeadOwnerIntelligenceSchema | None,
    status_code=status.HTTP_200_OK,
)
def get_owner_intelligence(
    lead_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get existing owner intelligence for a lead."""
    return crud.lead_owner_intelligence.get_by_lead_id(db_session, lead_id)


@router.get(
    "/action-costs",
    summary="Get Action Credit Costs",
    response_description="Credit cost per action type",
    status_code=status.HTTP_200_OK,
)
def get_action_costs(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return the credit cost for each billable action type."""
    return ACTION_COSTS


@router.get(
    "/admin/billing",
    summary="Admin Billing Overview",
    response_description="All users billing and usage data",
    response_model=AdminBillingOverview,
    status_code=status.HTTP_200_OK,
)
def admin_billing_overview(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Admin-only: Get billing overview for all users with wallets."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    wallets = crud.skiptrace_wallet.get_all_wallets(db_session)

    users_billing: list[AdminUserBilling] = []
    total_credits_in_circulation = 0
    total_credits_used = 0
    total_revenue_cents = 0

    for w in wallets:
        user = w.user
        if not user:
            continue

        is_admin = crud.user.has_admin_privileges(user)
        usage = crud.skiptrace_transaction.get_usage_by_action_type(db_session, w.id)
        last_activity = crud.skiptrace_transaction.get_last_activity(db_session, w.id)

        skip_traces = usage.get("skip_trace", 0)
        sms = usage.get("sms", 0)
        ai_calls = usage.get("ai_voice_call", 0)
        enrichments = usage.get("enrichment", 0)
        total_used = w.credits_used
        est_cost = total_used * COST_PER_CREDIT_CENTS

        role_name = user.role.display_name if user.role else "Unknown"
        display_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email

        users_billing.append(
            AdminUserBilling(
                user_id=user.id,
                user_name=display_name,
                user_email=user.email,
                role=role_name,
                credit_balance=w.credit_balance,
                is_unlimited=is_admin,
                skip_traces_used=skip_traces,
                sms_used=sms,
                ai_voice_calls_used=ai_calls,
                enrichments_used=enrichments,
                total_credits_used=total_used,
                estimated_cost_cents=est_cost,
                last_activity=last_activity,
                last_recharge=w.last_recharge_date,
                subscription_status="active" if user.is_active else "inactive",
            )
        )

        total_credits_in_circulation += w.credit_balance
        total_credits_used += total_used
        total_revenue_cents += est_cost

    return AdminBillingOverview(
        total_users=len(users_billing),
        total_credits_in_circulation=total_credits_in_circulation,
        total_credits_used=total_credits_used,
        total_revenue_cents=total_revenue_cents,
        users=users_billing,
    )
