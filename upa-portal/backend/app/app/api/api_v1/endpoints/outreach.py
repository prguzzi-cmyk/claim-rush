#!/usr/bin/env python

"""Routes for the Outreach Engine module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.exceptions import CrudUtil

router = APIRouter()

campaign_permissions = Permissions(Modules.OUTREACH_CAMPAIGN.value)
template_permissions = Permissions(Modules.OUTREACH_TEMPLATE.value)
crud_util_campaign = CrudUtil(crud.outreach_campaign)
crud_util_template = CrudUtil(crud.outreach_template)


# ──────────────────────────────────────────────
# CAMPAIGNS
# ──────────────────────────────────────────────

@router.get(
    "/campaigns",
    summary="List outreach campaigns",
    dependencies=[Depends(campaign_permissions.read())],
)
def list_campaigns(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    return crud.outreach_campaign.get_multi(db_session, paginated=False)


@router.post(
    "/campaigns/with-steps",
    summary="Create campaign with nested steps",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(campaign_permissions.create())],
)
def create_campaign_with_steps(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: schemas.OutreachCampaignCreateWithSteps,
) -> Any:
    return crud.outreach_campaign.create_with_steps(
        db_session, obj_in=obj_in, created_by_id=current_user.id
    )


class PreviewLeadsRequest(BaseModel):
    incident_type: str | None = None
    target_zip_code: str | None = None
    target_radius_miles: int | None = None
    lead_source: str | None = None
    territory_state: str | None = None


@router.post(
    "/campaigns/preview-leads",
    summary="Preview matching leads before launching",
    response_model=schemas.CampaignPreviewResponse,
    dependencies=[Depends(campaign_permissions.read())],
)
def preview_leads(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: PreviewLeadsRequest,
) -> Any:
    return crud.outreach_campaign.preview_targeted_leads(
        db_session,
        incident_type=obj_in.incident_type,
        target_zip_code=obj_in.target_zip_code,
        target_radius_miles=obj_in.target_radius_miles,
        lead_source=obj_in.lead_source,
        territory_state=obj_in.territory_state,
    )


@router.get(
    "/dashboard-metrics",
    summary="Get aggregated campaign dashboard metrics",
    response_model=schemas.CampaignDashboardMetrics,
    dependencies=[Depends(campaign_permissions.read())],
)
def get_dashboard_metrics(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    return crud.outreach_campaign.get_dashboard_metrics(db_session)


@router.post(
    "/campaigns",
    summary="Create outreach campaign",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(campaign_permissions.create())],
)
def create_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: schemas.OutreachCampaignCreate,
) -> Any:
    return crud.outreach_campaign.create(db_session, obj_in=obj_in)


@router.put(
    "/campaigns/{campaign_id}",
    summary="Update outreach campaign",
    dependencies=[Depends(campaign_permissions.update())],
)
def update_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
    obj_in: schemas.OutreachCampaignUpdate,
) -> Any:
    db_obj = crud_util_campaign.get_or_404(db_session, obj_id=campaign_id)
    return crud.outreach_campaign.update(db_session, db_obj=db_obj, obj_in=obj_in)


@router.delete(
    "/campaigns/{campaign_id}",
    summary="Delete outreach campaign",
    dependencies=[Depends(campaign_permissions.remove())],
)
def delete_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
) -> Any:
    return crud.outreach_campaign.hard_remove(db_session, obj_id=campaign_id)


@router.post(
    "/campaigns/{campaign_id}/toggle",
    summary="Toggle campaign active status",
    dependencies=[Depends(campaign_permissions.update())],
)
def toggle_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
) -> Any:
    db_obj = crud_util_campaign.get_or_404(db_session, obj_id=campaign_id)
    return crud.outreach_campaign.update(
        db_session, db_obj=db_obj, obj_in={"is_active": not db_obj.is_active}
    )


@router.post(
    "/campaigns/{campaign_id}/launch",
    summary="Launch campaign — set active and dispatch execution",
    dependencies=[Depends(campaign_permissions.update())],
)
def launch_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
) -> Any:
    result = crud.outreach_campaign.launch_campaign(db_session, campaign_id=campaign_id)
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result


@router.post(
    "/campaigns/{campaign_id}/pause",
    summary="Pause an active campaign",
    dependencies=[Depends(campaign_permissions.update())],
)
def pause_campaign(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
) -> Any:
    result = crud.outreach_campaign.pause_campaign(db_session, campaign_id=campaign_id)
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result


# ──────────────────────────────────────────────
# CAMPAIGN STEPS
# ──────────────────────────────────────────────

@router.get(
    "/campaigns/{campaign_id}/steps",
    summary="List steps for a campaign",
    dependencies=[Depends(campaign_permissions.read())],
)
def list_campaign_steps(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
) -> Any:
    return crud.campaign_step.get_by_campaign(db_session, campaign_id=campaign_id)


@router.post(
    "/campaigns/{campaign_id}/steps",
    summary="Add step to campaign",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(campaign_permissions.create())],
)
def create_campaign_step(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
    obj_in: schemas.CampaignStepCreate,
) -> Any:
    obj_in.campaign_id = campaign_id
    return crud.campaign_step.create(db_session, obj_in=obj_in)


@router.delete(
    "/campaigns/{campaign_id}/steps/{step_id}",
    summary="Remove step from campaign",
    dependencies=[Depends(campaign_permissions.remove())],
)
def delete_campaign_step(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID,
    step_id: UUID,
) -> Any:
    return crud.campaign_step.hard_remove(db_session, obj_id=step_id)


# ──────────────────────────────────────────────
# TEMPLATES
# ──────────────────────────────────────────────

@router.get(
    "/templates",
    summary="List outreach templates",
    dependencies=[Depends(template_permissions.read())],
)
def list_templates(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    channel: str | None = Query(default=None),
) -> Any:
    if channel:
        return crud.outreach_template.get_by_channel(db_session, channel=channel)
    return crud.outreach_template.get_multi(db_session, paginated=False)


@router.post(
    "/templates",
    summary="Create outreach template",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(template_permissions.create())],
)
def create_template(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: schemas.OutreachTemplateCreate,
) -> Any:
    return crud.outreach_template.create(db_session, obj_in=obj_in)


@router.put(
    "/templates/{template_id}",
    summary="Update outreach template",
    dependencies=[Depends(template_permissions.update())],
)
def update_template(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    template_id: UUID,
    obj_in: schemas.OutreachTemplateUpdate,
) -> Any:
    db_obj = crud_util_template.get_or_404(db_session, obj_id=template_id)
    return crud.outreach_template.update(db_session, db_obj=db_obj, obj_in=obj_in)


@router.delete(
    "/templates/{template_id}",
    summary="Delete outreach template",
    dependencies=[Depends(template_permissions.remove())],
)
def delete_template(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    template_id: UUID,
) -> Any:
    return crud.outreach_template.hard_remove(db_session, obj_id=template_id)


@router.post(
    "/templates/preview",
    summary="Preview rendered template with sample data",
    dependencies=[Depends(template_permissions.read())],
)
def preview_template(
    *,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: schemas.TemplatePreviewRequest,
) -> schemas.TemplatePreviewResponse:
    sample_data = {
        "owner_name": "John Smith",
        "property_address": "123 Main St, Austin TX 78701",
        "incident_type": "Fire",
        "adjuster_name": f"{current_user.first_name} {current_user.last_name}",
    }
    rendered = crud.outreach_template.render_template(obj_in.body, sample_data)
    return schemas.TemplatePreviewResponse(rendered=rendered)


# ──────────────────────────────────────────────
# ATTEMPTS
# ──────────────────────────────────────────────

@router.get(
    "/attempts",
    summary="List outreach attempts",
    dependencies=[Depends(campaign_permissions.read())],
)
def list_attempts(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID | None = Query(default=None),
    lead_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> Any:
    filters = []
    if campaign_id:
        filters.append(models.OutreachAttempt.campaign_id == campaign_id)
    if lead_id:
        filters.append(models.OutreachAttempt.lead_id == lead_id)
    if status_filter:
        filters.append(models.OutreachAttempt.status == status_filter)

    return crud.outreach_attempt.get_multi(
        db_session,
        filters=filters if filters else None,
        order_by=[models.OutreachAttempt.created_at.desc()],
        paginated=False,
    )


@router.get(
    "/attempts/metrics",
    summary="Get outreach metrics",
    response_model=schemas.OutreachMetrics,
    dependencies=[Depends(campaign_permissions.read())],
)
def get_metrics(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID | None = Query(default=None),
) -> Any:
    return crud.outreach_attempt.get_metrics(db_session, campaign_id=campaign_id)


# ──────────────────────────────────────────────
# CONVERSATIONS
# ──────────────────────────────────────────────

@router.get(
    "/conversations/{lead_id}",
    summary="Get conversation thread for a lead",
    dependencies=[Depends(campaign_permissions.read())],
)
def get_conversation(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: UUID,
) -> Any:
    return crud.conversation_message.get_thread(db_session, lead_id=lead_id)


@router.post(
    "/conversations/{lead_id}",
    summary="Add outbound message to conversation",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(campaign_permissions.create())],
)
def add_message(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    lead_id: UUID,
    obj_in: schemas.ConversationMessageCreate,
) -> Any:
    obj_in.lead_id = lead_id
    obj_in.direction = "outbound"
    obj_in.sender_type = "agent"
    obj_in.sender_id = current_user.id
    return crud.conversation_message.create(db_session, obj_in=obj_in)


# ──────────────────────────────────────────────
# MANUAL TRIGGER
# ──────────────────────────────────────────────

@router.post(
    "/trigger",
    summary="Manually trigger outreach for a campaign + lead",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(campaign_permissions.create())],
)
def trigger_outreach(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    campaign_id: UUID = Query(),
    lead_id: UUID = Query(),
) -> Any:
    from app.tasks.outreach import execute_outreach_task

    execute_outreach_task.delay(str(campaign_id), str(lead_id))
    return {"msg": "Outreach task dispatched.", "campaign_id": str(campaign_id), "lead_id": str(lead_id)}
