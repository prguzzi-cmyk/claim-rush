#!/usr/bin/env python

"""API endpoints for Intake Config (admin control layer)"""

import logging
import traceback as tb
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.models.intake_config import IntakeConfig
from app.schemas.intake_config import (
    IntakeConfig as IntakeConfigSchema,
    IntakeConfigCreate,
    IntakeConfigUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()
permissions = Permissions(Modules.LEAD.value)


def _build_response_dict(session: Session, cfg: IntakeConfig) -> dict:
    """Build a plain dict for the response while the session is still open.

    This avoids DetachedInstanceError by reading relationships inside the
    active session context.
    """
    # Read all scalar fields first
    data = {
        "id": cfg.id,
        "intake_name": cfg.intake_name,
        "slug": cfg.slug,
        "is_active": cfg.is_active,
        "campaign_tag": cfg.campaign_tag,
        "rep_name": cfg.rep_name,
        "rep_title": cfg.rep_title,
        "rep_phone": cfg.rep_phone,
        "rep_email": cfg.rep_email,
        "ai_secretary_enabled": cfg.ai_secretary_enabled,
        "assigned_cp_id": cfg.assigned_cp_id,
        "assigned_rvp_id": cfg.assigned_rvp_id,
        "assigned_agent_id": cfg.assigned_agent_id,
        "territory_id": cfg.territory_id,
        "default_assignee_id": cfg.default_assignee_id,
        "fallback_home_office": cfg.fallback_home_office,
        "rescue_enabled": cfg.rescue_enabled,
        "territory_enforcement": cfg.territory_enforcement,
        "voice_script_version": cfg.voice_script_version,
        "sms_script_version": cfg.sms_script_version,
        "intake_opening_script": cfg.intake_opening_script,
        "brochure_link": cfg.brochure_link,
        "public_url": cfg.public_url,
        "tracked_outreach_url": cfg.tracked_outreach_url,
        "qr_link": cfg.qr_link,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
        # Resolved names — read relationships while session is active
        "assigned_cp_name": None,
        "assigned_rvp_name": None,
        "assigned_agent_name": None,
        "default_assignee_name": None,
        "territory_name": None,
    }

    # Safely resolve relationship names inside the session
    for attr, key in [
        ("assigned_cp", "assigned_cp_name"),
        ("assigned_rvp", "assigned_rvp_name"),
        ("assigned_agent", "assigned_agent_name"),
        ("default_assignee", "default_assignee_name"),
    ]:
        try:
            user = getattr(cfg, attr, None)
            if user:
                data[key] = f"{user.first_name} {user.last_name}"
        except Exception:
            pass

    try:
        t = getattr(cfg, "territory", None)
        if t:
            data["territory_name"] = t.name
    except Exception:
        pass

    return data


@router.get(
    "",
    summary="List Intake Configs",
    response_model=list[IntakeConfigSchema],
    dependencies=[Depends(permissions.read())],
)
def list_configs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """List all intake configurations."""
    with db_session as session:
        from sqlalchemy import select
        configs = list(session.execute(
            select(IntakeConfig).order_by(IntakeConfig.created_at.desc())
        ).scalars().all())
        return [_build_response_dict(session, c) for c in configs]


@router.get(
    "/{config_id}",
    summary="Get Intake Config",
    response_model=IntakeConfigSchema,
    dependencies=[Depends(permissions.read())],
)
def get_config(
    config_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single intake config by ID."""
    with db_session as session:
        cfg = session.get(IntakeConfig, config_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Intake config not found")
        return _build_response_dict(session, cfg)


@router.post(
    "",
    summary="Create Intake Config",
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_config(
    config_in: IntakeConfigCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new intake configuration with a unique slug."""
    logger.info(
        "Intake config create: slug=%s, user=%s",
        config_in.slug, current_user.id,
    )

    result = None

    try:
        with db_session as session:
            from sqlalchemy import select

            existing = session.scalars(
                select(IntakeConfig).where(IntakeConfig.slug == config_in.slug)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slug '{config_in.slug}' is already in use.",
                )

            base_url = f"/intake/{config_in.slug}"
            cfg = IntakeConfig(
                intake_name=config_in.intake_name or "ACI Claim Intake",
                slug=config_in.slug,
                is_active=config_in.is_active if config_in.is_active is not None else True,
                campaign_tag=config_in.campaign_tag or None,
                rep_name=config_in.rep_name or None,
                rep_title=config_in.rep_title or None,
                rep_phone=config_in.rep_phone or None,
                rep_email=config_in.rep_email or None,
                ai_secretary_enabled=config_in.ai_secretary_enabled or False,
                assigned_cp_id=config_in.assigned_cp_id or None,
                assigned_rvp_id=config_in.assigned_rvp_id or None,
                assigned_agent_id=config_in.assigned_agent_id or None,
                territory_id=config_in.territory_id or None,
                default_assignee_id=config_in.default_assignee_id or None,
                fallback_home_office=config_in.fallback_home_office if config_in.fallback_home_office is not None else True,
                rescue_enabled=config_in.rescue_enabled if config_in.rescue_enabled is not None else True,
                territory_enforcement=config_in.territory_enforcement or False,
                public_url=config_in.public_url or base_url,
                tracked_outreach_url=config_in.tracked_outreach_url or f"{base_url}?src=outreach",
                qr_link=config_in.qr_link or f"{base_url}?src=qr",
            )

            session.add(cfg)
            session.flush()

            # Extract values BEFORE commit, into plain Python strings
            result = {
                "id": str(cfg.id),
                "slug": str(cfg.slug),
                "public_url": str(cfg.public_url),
                "tracked_outreach_url": str(cfg.tracked_outreach_url),
                "message": "created",
            }

            session.commit()

        # with block is now closed — cfg is detached — but we never touch cfg again
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Intake config create failed: %s", exc, exc_info=True)
        return {"error": "Intake config creation failed"}

    return result


@router.patch(
    "/{config_id}",
    summary="Update Intake Config",
    response_model=IntakeConfigSchema,
    dependencies=[Depends(permissions.update())],
)
def update_config(
    config_id: UUID,
    config_in: IntakeConfigUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update intake config fields."""
    with db_session as session:
        cfg = session.get(IntakeConfig, config_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Intake config not found")

        update_data = config_in.dict(exclude_unset=True)

        # If slug changed, regenerate links
        if "slug" in update_data and update_data["slug"] != cfg.slug:
            new_slug = update_data["slug"]
            from sqlalchemy import select
            dup = session.scalars(
                select(IntakeConfig).where(IntakeConfig.slug == new_slug)
            ).first()
            if dup and dup.id != config_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slug '{new_slug}' is already in use.",
                )
            base = f"/intake/{new_slug}"
            update_data.setdefault("public_url", base)
            update_data.setdefault("tracked_outreach_url", f"{base}?src=outreach")
            update_data.setdefault("qr_link", f"{base}?src=qr")

        for field, value in update_data.items():
            setattr(cfg, field, value)

        session.flush()
        response = _build_response_dict(session, cfg)
        session.commit()
        logger.info("Intake config updated: slug=%s id=%s", cfg.slug, cfg.id)
        return response


@router.delete(
    "/{config_id}",
    summary="Delete Intake Config",
    dependencies=[Depends(permissions.update())],
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_config(
    config_id: UUID,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> None:
    """Delete an intake configuration."""
    if not crud.user.has_admin_privileges(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    with db_session as session:
        cfg = session.get(IntakeConfig, config_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Intake config not found")
        session.delete(cfg)
        session.commit()
        logger.info("Intake config deleted: id=%s", config_id)
