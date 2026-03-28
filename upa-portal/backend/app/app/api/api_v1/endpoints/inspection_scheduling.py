#!/usr/bin/env python

"""Routes for the Inspection Scheduling module"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.rbac import Modules
from app.utils.exceptions import CrudUtil

router = APIRouter()

schedule_permissions = Permissions(Modules.INSPECTION_SCHEDULE.value)
availability_permissions = Permissions(Modules.INSPECTION_AVAILABILITY.value)
crud_util = CrudUtil(crud.inspection_schedule)


# ──────────────────────────────────────────────
# INSPECTIONS
# ──────────────────────────────────────────────

@router.get(
    "",
    summary="List inspections",
    dependencies=[Depends(schedule_permissions.read())],
)
def list_inspections(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    date: str | None = Query(default=None),
    adjuster_id: UUID | None = Query(default=None),
    inspection_status: str | None = Query(default=None, alias="status"),
) -> Any:
    return crud.inspection_schedule.get_filtered(
        db_session, date=date, adjuster_id=adjuster_id, status=inspection_status,
    )


@router.post(
    "",
    summary="Create inspection",
    status_code=status.HTTP_201_CREATED,
    response_model=schemas.InspectionScheduleSchema,
    dependencies=[Depends(schedule_permissions.create())],
)
def create_inspection(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    obj_in: schemas.InspectionScheduleCreate,
) -> Any:
    # Server-side conflict check
    if obj_in.adjuster_id and obj_in.inspection_time:
        conflict = crud.inspection_schedule.check_conflict(
            db_session,
            adjuster_id=obj_in.adjuster_id,
            date=obj_in.inspection_date,
            time=obj_in.inspection_time,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Adjuster already has an inspection at {obj_in.inspection_time} on {obj_in.inspection_date}.",
            )

    from app.utils.user_context import UserContext
    UserContext.set(current_user.id)

    obj_data = obj_in.dict()
    obj_data["created_by_id"] = current_user.id
    if not obj_data.get("end_time"):
        # Default to 1 hour after start
        hour = int(obj_in.inspection_time.split(":")[0]) + 1
        obj_data["end_time"] = f"{hour:02d}:{obj_in.inspection_time.split(':')[1]}"

    return crud.inspection_schedule.create(
        db_session, obj_in=schemas.InspectionScheduleCreate(**obj_data),
    )


@router.patch(
    "/{inspection_id}",
    summary="Update inspection",
    response_model=schemas.InspectionScheduleSchema,
    dependencies=[Depends(schedule_permissions.update())],
)
def update_inspection(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    inspection_id: UUID,
    obj_in: schemas.InspectionScheduleUpdate,
) -> Any:
    db_obj = crud_util.get_object_or_raise_exception(db_session, obj_id=inspection_id)

    update_data = obj_in.dict(exclude_unset=True)
    # If rescheduling, check for conflicts
    new_date = update_data.get("inspection_date", db_obj.inspection_date)
    new_time = update_data.get("inspection_time", db_obj.inspection_time)
    adj_id = update_data.get("adjuster_id", db_obj.adjuster_id)
    if adj_id and (
        new_date != db_obj.inspection_date
        or new_time != db_obj.inspection_time
        or adj_id != db_obj.adjuster_id
    ):
        conflict = crud.inspection_schedule.check_conflict(
            db_session,
            adjuster_id=adj_id,
            date=new_date,
            time=new_time,
            exclude_id=inspection_id,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Adjuster already has an inspection at {new_time} on {new_date}.",
            )

    return crud.inspection_schedule.update(
        db_session, db_obj=db_obj, obj_in=obj_in,
    )


@router.delete(
    "/{inspection_id}",
    summary="Delete inspection",
    response_model=schemas.Msg,
    dependencies=[Depends(schedule_permissions.remove())],
)
def delete_inspection(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    inspection_id: UUID,
) -> Any:
    crud.inspection_schedule.hard_remove(db_session, obj_id=inspection_id)
    return {"msg": "Inspection deleted."}


@router.get(
    "/upcoming",
    summary="Upcoming inspections",
    dependencies=[Depends(schedule_permissions.read())],
)
def upcoming_inspections(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    limit: int = Query(default=10, ge=1, le=100),
) -> Any:
    return crud.inspection_schedule.get_upcoming(db_session, limit=limit)


# ──────────────────────────────────────────────
# AVAILABILITY
# ──────────────────────────────────────────────

@router.get(
    "/availability/{adjuster_id}",
    summary="Get adjuster availability",
    response_model=schemas.AdjusterAvailabilitySchema,
    dependencies=[Depends(availability_permissions.read())],
)
def get_availability(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    adjuster_id: UUID,
) -> Any:
    result = crud.adjuster_availability.get_by_adjuster(db_session, adjuster_id=adjuster_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability not found for this adjuster.",
        )
    return result


@router.put(
    "/availability/{adjuster_id}",
    summary="Save/update adjuster availability",
    response_model=schemas.AdjusterAvailabilitySchema,
    dependencies=[Depends(availability_permissions.update())],
)
def save_availability(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    adjuster_id: UUID,
    obj_in: schemas.AdjusterAvailabilityCreate,
) -> Any:
    return crud.adjuster_availability.save_or_update(
        db_session, adjuster_id=adjuster_id, obj_in=obj_in,
    )


# ──────────────────────────────────────────────
# REMINDERS
# ──────────────────────────────────────────────

@router.post(
    "/{inspection_id}/remind",
    summary="Send inspection reminder",
    dependencies=[Depends(schedule_permissions.update())],
)
def send_reminder(
    *,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    inspection_id: UUID,
    body: schemas.InspectionReminderRequest,
) -> Any:
    db_obj = crud_util.get_object_or_raise_exception(db_session, obj_id=inspection_id)

    from app.tasks.inspection_scheduling import send_inspection_reminder
    send_inspection_reminder.delay(
        str(inspection_id), body.target, body.channel,
    )
    return {"msg": f"Reminder ({body.channel}) queued for {body.target}."}
