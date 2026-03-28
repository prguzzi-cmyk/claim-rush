#!/usr/bin/env python

"""WebAuthn / Passkey Routes"""

import json
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes, options_to_json
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app import crud, models, schemas
from app.api import deps
from app.core import security
from app.core.brute_force import record_login_attempt
from app.core.challenge_store import get_challenge, save_challenge
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.user_passkey import UserPasskey

router = APIRouter()


def _options_to_dict(options) -> dict:
    """Serialize py-webauthn options to a JSON-safe dict."""
    return json.loads(options_to_json(options))


@router.post("/register/options")
def webauthn_register_options(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_user)],
    body: schemas.WebAuthnRegisterOptionsRequest | None = None,
) -> Any:
    """Generate WebAuthn registration options (requires auth)."""
    # Get existing credentials for excludeCredentials
    existing = (
        db_session.query(UserPasskey)
        .filter(UserPasskey.user_id == current_user.id)
        .all()
    )
    exclude_creds = [
        PublicKeyCredentialDescriptor(id=p.credential_id)
        for p in existing
    ]

    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(current_user.id).encode(),
        user_name=current_user.email,
        user_display_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude_creds,
    )

    # Store challenge for verification
    save_challenge(f"reg:{current_user.id}", options.challenge)

    return _options_to_dict(options)


@router.post("/register/verify")
def webauthn_register_verify(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_user)],
    body: schemas.WebAuthnRegisterVerifyRequest,
) -> Any:
    """Verify WebAuthn registration and store credential."""
    challenge = get_challenge(f"reg:{current_user.id}")
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration challenge expired or not found.",
        )

    try:
        verification = verify_registration_response(
            credential=body.credential,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration verification failed: {str(e)}",
        )

    # Store the credential
    passkey = UserPasskey(
        user_id=current_user.id,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        device_name=body.device_name,
        transports=json.dumps(body.credential.get("response", {}).get("transports", []))
        if isinstance(body.credential, dict)
        else None,
        backed_up=verification.credential_backed_up if hasattr(verification, "credential_backed_up") else False,
    )
    db_session.add(passkey)
    db_session.commit()

    return {"status": "ok", "device_name": body.device_name}


@router.post("/authenticate/options")
@limiter.limit("20/minute")
def webauthn_authenticate_options(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    body: schemas.WebAuthnAuthenticateOptionsRequest | None = None,
) -> Any:
    """Generate WebAuthn authentication options (no auth required)."""
    allow_credentials = []

    if body and body.email:
        user = crud.user.get_by_email(db_session, email=body.email)
        if user:
            passkeys = (
                db_session.query(UserPasskey)
                .filter(UserPasskey.user_id == user.id)
                .all()
            )
            allow_credentials = [
                PublicKeyCredentialDescriptor(
                    id=p.credential_id,
                    transports=json.loads(p.transports) if p.transports else None,
                )
                for p in passkeys
            ]

    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=allow_credentials if allow_credentials else None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    # Store challenge keyed by a nonce from the challenge itself
    challenge_key = bytes_to_base64url(options.challenge)
    save_challenge(f"auth:{challenge_key}", options.challenge)

    response = _options_to_dict(options)
    response["_challenge_key"] = challenge_key
    return response


@router.post("/authenticate/verify")
@limiter.limit("10/minute")
def webauthn_authenticate_verify(
    request: Request,
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    body: schemas.WebAuthnAuthenticateVerifyRequest,
) -> Any:
    """Verify WebAuthn authentication and issue JWT."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")

    # Extract credential_id from the response
    cred = body.credential
    if isinstance(cred, dict):
        raw_id = cred.get("rawId") or cred.get("id", "")
    else:
        raise HTTPException(status_code=400, detail="Invalid credential format")

    try:
        cred_id_bytes = base64url_to_bytes(raw_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid credential ID")

    # Look up the passkey
    passkey = (
        db_session.query(UserPasskey)
        .filter(UserPasskey.credential_id == cred_id_bytes)
        .first()
    )
    if not passkey:
        raise HTTPException(status_code=401, detail="Unknown credential")

    # Get the challenge key from the request
    challenge_key = request.headers.get("x-challenge-key", "")
    if not challenge_key and isinstance(cred, dict):
        challenge_key = cred.get("_challenge_key", "")

    challenge = get_challenge(f"auth:{challenge_key}")
    if not challenge:
        raise HTTPException(status_code=400, detail="Challenge expired or not found")

    try:
        verification = verify_authentication_response(
            credential=cred,
            expected_challenge=challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
        )
    except Exception as e:
        record_login_attempt(
            db_session,
            email="passkey",
            ip_address=ip,
            user_agent=ua,
            method="passkey",
            success=False,
            failure_reason=str(e),
            user_id=passkey.user_id,
        )
        raise HTTPException(status_code=401, detail="Authentication failed")

    # Update sign count and last_used_at
    passkey.sign_count = verification.new_sign_count
    passkey.last_used_at = datetime.utcnow()
    db_session.commit()

    # Look up user
    user = db_session.query(models.User).filter(models.User.id == passkey.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    record_login_attempt(
        db_session,
        email=user.email,
        ip_address=ip,
        user_agent=ua,
        method="passkey",
        success=True,
        user_id=user.id,
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.get("/credentials")
def webauthn_credentials(
    db_session: Annotated[Session, Depends(deps.get_db_session)],
    current_user: Annotated[models.User, Depends(deps.get_current_user)],
) -> Any:
    """List the current user's registered passkeys."""
    passkeys = (
        db_session.query(UserPasskey)
        .filter(UserPasskey.user_id == current_user.id)
        .all()
    )
    return [
        {
            "id": bytes_to_base64url(p.credential_id),
            "device_name": p.device_name,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "last_used_at": p.last_used_at.isoformat() if p.last_used_at else None,
            "backed_up": p.backed_up,
        }
        for p in passkeys
    ]
