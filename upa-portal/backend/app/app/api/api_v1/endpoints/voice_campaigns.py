#!/usr/bin/env python

"""Voice Campaigns API endpoints"""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.schemas.voice_campaign import (
    CampaignLaunchRequest,
    VoiceCampaign as VoiceCampaignSchema,
    VoiceCampaignAnalytics,
    VoiceCampaignCreate,
    VoiceCampaignUpdate,
    VoiceCallLogDetail,
    VoiceCallLogSchema,
    VoiceUsageSummary,
)
from app.services.voice_campaign_service import voice_campaign_service
from app.utils.contexts import UserContext

logger = logging.getLogger(__name__)
router = APIRouter()
permissions = Permissions(Modules.VOICE_CAMPAIGN.value)


# ─── Campaign CRUD ──────────────────────────────────────────────


@router.post(
    "/",
    summary="Create a voice campaign",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.create())],
)
def create_campaign(
    body: VoiceCampaignCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = voice_campaign_service.create_campaign(
        db_session, data=body, user_id=current_user.id
    )
    db_session.commit()
    return campaign


@router.get(
    "/",
    summary="List all voice campaigns",
    response_model=list[VoiceCampaignSchema],
    dependencies=[Depends(permissions.read())],
)
def list_campaigns(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    status: str | None = Query(default=None, description="Filter by status"),
) -> Any:
    if status:
        return crud.voice_campaign.get_by_status(db_session, status=status)
    return crud.voice_campaign.get_multi(db_session=db_session, paginated=False)


@router.get(
    "/call-logs",
    summary="List all call logs",
    response_model=list[VoiceCallLogSchema],
    dependencies=[Depends(permissions.read())],
)
def list_call_logs(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID | None = Query(default=None),
    outcome: str | None = Query(default=None),
) -> Any:
    return crud.voice_call_log.get_filtered(
        db_session, campaign_id=campaign_id, outcome=outcome
    )


@router.get(
    "/call-logs/{call_log_id}",
    summary="Get call log detail",
    response_model=VoiceCallLogDetail,
    dependencies=[Depends(permissions.read())],
)
def get_call_log_detail(
    call_log_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    call_log = crud.voice_call_log.get_with_transcript(db_session, obj_id=call_log_id)
    if not call_log:
        raise HTTPException(status_code=404, detail="Call log not found")
    result = VoiceCallLogDetail.model_validate(call_log, from_attributes=True)
    if call_log.campaign:
        result.campaign_name = call_log.campaign.name
    return result


@router.get(
    "/transcripts/{call_id}",
    summary="Get transcript for a call",
    response_model=VoiceCallLogDetail,
    dependencies=[Depends(permissions.read())],
)
def get_transcript(
    call_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    call_log = crud.voice_call_log.get_with_transcript(db_session, obj_id=call_id)
    if not call_log:
        raise HTTPException(status_code=404, detail="Call log not found")
    result = VoiceCallLogDetail.model_validate(call_log, from_attributes=True)
    if call_log.campaign:
        result.campaign_name = call_log.campaign.name
    return result


@router.get(
    "/active-call-count",
    summary="Get count of currently active AI voice calls",
    dependencies=[Depends(permissions.read())],
)
def get_active_call_count(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> dict[str, int]:
    """Return the number of voice calls currently in 'initiated' or 'ringing' or 'connected' status."""
    try:
        from sqlalchemy import func, select
        from app.models.voice_call_log import VoiceCallLog

        active_statuses = ("initiated", "ringing", "connected")
        count = db_session.execute(
            select(func.count())
            .select_from(VoiceCallLog)
            .where(VoiceCallLog.status.in_(active_statuses))
        ).scalar() or 0
        return {"count": count}
    except Exception as e:
        logger.warning("active-call-count query failed: %s", e)
        return {"count": 0}


@router.get(
    "/analytics",
    summary="Get global voice campaign analytics",
    response_model=VoiceCampaignAnalytics,
    dependencies=[Depends(permissions.read())],
)
def get_global_analytics(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    return voice_campaign_service.get_global_analytics(db_session)


@router.get(
    "/analytics/{campaign_id}",
    summary="Get per-campaign analytics",
    response_model=VoiceCampaignAnalytics,
    dependencies=[Depends(permissions.read())],
)
def get_campaign_analytics(
    campaign_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    return voice_campaign_service.get_campaign_analytics(
        db_session, campaign_id=campaign_id
    )


@router.get(
    "/usage",
    summary="Get voice usage summary",
    response_model=VoiceUsageSummary,
    dependencies=[Depends(permissions.read())],
)
def get_usage(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    return voice_campaign_service.get_usage_summary(
        db_session, account_id=current_user.id
    )


@router.get(
    "/{campaign_id}",
    summary="Get campaign detail",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.read())],
)
def get_campaign(
    campaign_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch(
    "/{campaign_id}",
    summary="Update a voice campaign",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.update())],
)
def update_campaign(
    campaign_id: Annotated[UUID, Path()],
    body: VoiceCampaignUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    updated = crud.voice_campaign.update(
        db_session=db_session, db_obj=campaign, obj_in=body
    )
    db_session.commit()
    return updated


@router.post(
    "/{campaign_id}/launch",
    summary="Launch a voice campaign",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.update())],
)
def launch_campaign(
    campaign_id: Annotated[UUID, Path()],
    body: CampaignLaunchRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = voice_campaign_service.launch_campaign(
        db_session,
        campaign_id=campaign_id,
        lead_ids=body.lead_ids,
        user_id=current_user.id,
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db_session.commit()
    return campaign


@router.post(
    "/{campaign_id}/pause",
    summary="Pause a voice campaign",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.update())],
)
def pause_campaign(
    campaign_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = voice_campaign_service.pause_campaign(
        db_session, campaign_id=campaign_id
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db_session.commit()
    return campaign


@router.post(
    "/{campaign_id}/resume",
    summary="Resume a paused voice campaign",
    response_model=VoiceCampaignSchema,
    dependencies=[Depends(permissions.update())],
)
def resume_campaign(
    campaign_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused campaigns can be resumed")
    with db_session as session:
        campaign.status = "active"
        session.add(campaign)
        session.flush()
    db_session.commit()
    return campaign


@router.delete(
    "/{campaign_id}",
    summary="Delete a voice campaign (soft delete)",
    dependencies=[Depends(permissions.remove())],
)
def delete_campaign(
    campaign_id: Annotated[UUID, Path()],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    UserContext.set(current_user.id)
    campaign = crud.voice_campaign.get(db_session=db_session, obj_id=campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    crud.voice_campaign.remove(db_session=db_session, obj_id=campaign_id)
    db_session.commit()
    return {"detail": "Campaign deleted"}
