#!/usr/bin/env python

"""Routes for the Estimate Projects module"""

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from fastapi.encoders import jsonable_encoder
from openai import OpenAI
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.models.estimate_line_item import EstimateLineItem
from app.models.estimate_project import EstimateProject
from app.models.estimate_room import EstimateRoom
from app.models.policy_document import PolicyDocument
from app.schemas.estimate_line_item import EstimateLineItemCreate, EstimateLineItemUpdate
from app.schemas.estimate_project import (
    EstimateProjectCreate,
    EstimateProjectUpdate,
)
from app.schemas.estimate_room import EstimateRoomCreate, EstimateRoomUpdate
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

router = APIRouter()
logger = logging.getLogger(__name__)

permissions = Permissions(Modules.ESTIMATE_PROJECT.value)
crud_util_project = CrudUtil(crud.estimate_project)
crud_util_room = CrudUtil(crud.estimate_room)
crud_util_line_item = CrudUtil(crud.estimate_line_item)


# ──────────────────────────────────────────────────
# Estimate Projects
# ──────────────────────────────────────────────────

@router.get(
    "",
    summary="List Estimate Projects",
    response_description="Paginated list of estimate projects",
    response_model=CustomPage[schemas.EstimateProject],
    dependencies=[Depends(permissions.read())],
)
def read_estimate_projects(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve all estimate projects."""
    return crud.estimate_project.get_multi(
        db_session,
        order_by=[EstimateProject.created_at.desc()],
    )


ESTIMATE_MODE_CONFIG: dict[str, dict] = {
    "residential": {
        "label": "Residential",
        "description": "Standard home / dwelling estimates",
        "icon": "home",
        "room_types": [
            "kitchen", "bathroom", "bedroom", "living_room", "dining_room",
            "garage", "basement", "attic", "hallway", "exterior", "other",
        ],
        "line_item_categories": [
            "walls", "ceiling", "floor", "trim", "doors",
            "windows", "cabinets", "fixtures", "misc_items",
        ],
        "unit_options": ["SF", "LF", "SY", "EA", "HR", "CF", "GAL"],
    },
    "commercial": {
        "label": "Commercial",
        "description": "Commercial property / building estimates",
        "icon": "business",
        "room_types": [
            "kitchen", "bathroom", "bedroom", "living_room", "dining_room",
            "garage", "basement", "attic", "hallway", "exterior", "other",
            "lobby", "suite", "office", "common_area", "mechanical",
            "elevator", "stairwell", "parking", "roof", "restroom",
        ],
        "line_item_categories": [
            "walls", "ceiling", "floor", "trim", "doors",
            "windows", "cabinets", "fixtures", "misc_items",
            "hvac", "electrical", "plumbing", "fire_protection",
        ],
        "unit_options": ["SF", "LF", "SY", "EA", "HR", "CF", "GAL", "TON"],
    },
    "restoration": {
        "label": "Restoration",
        "description": "Water / fire / mold restoration estimates",
        "icon": "build",
        "room_types": [
            "kitchen", "bathroom", "bedroom", "living_room", "dining_room",
            "garage", "basement", "attic", "hallway", "exterior", "other",
        ],
        "line_item_categories": [
            "walls", "ceiling", "floor", "trim", "doors",
            "windows", "cabinets", "fixtures", "misc_items",
            "extraction", "drying_equipment", "containment",
            "demo", "antimicrobial", "monitoring",
        ],
        "unit_options": ["SF", "LF", "SY", "EA", "HR", "CF", "GAL", "DAY"],
    },
    "contents": {
        "label": "Contents",
        "description": "Personal property / contents-only estimates",
        "icon": "inventory_2",
        "room_types": [
            "kitchen", "bathroom", "bedroom", "living_room", "dining_room",
            "garage", "basement", "attic", "other",
        ],
        "line_item_categories": [
            "furniture", "electronics", "clothing", "appliances",
            "collectibles", "documents", "misc_items",
        ],
        "unit_options": ["EA", "SET", "LOT"],
    },
    "supplement": {
        "label": "Supplement",
        "description": "Supplement / additional scope estimates",
        "icon": "post_add",
        "room_types": [
            "kitchen", "bathroom", "bedroom", "living_room", "dining_room",
            "garage", "basement", "attic", "hallway", "exterior", "other",
        ],
        "line_item_categories": [
            "walls", "ceiling", "floor", "trim", "doors",
            "windows", "cabinets", "fixtures", "misc_items",
        ],
        "unit_options": ["SF", "LF", "SY", "EA", "HR", "CF", "GAL"],
        "default_view": "blackout",
    },
}


@router.get(
    "/mode-config",
    summary="Get Estimate Mode Configuration",
    response_description="Room types, categories, and units per estimate mode",
    dependencies=[Depends(permissions.read())],
)
def get_mode_config(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> dict:
    """Return the mode configuration dictionary for all estimate modes."""
    return ESTIMATE_MODE_CONFIG


@router.get(
    "/{project_id}",
    summary="Get Estimate Project",
    response_description="Estimate project detail with rooms and line items",
    response_model=schemas.EstimateProject,
    dependencies=[Depends(permissions.read())],
)
def read_estimate_project(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single estimate project with all nested details."""
    project = crud.estimate_project.get_with_details(db_session, obj_id=project_id)
    if not project:
        crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)
    return project


@router.post(
    "",
    summary="Create Estimate Project",
    response_description="Newly created estimate project",
    response_model=schemas.EstimateProject,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_estimate_project(
    project_in: EstimateProjectCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new estimate project, optionally with rooms and line items."""
    return crud.estimate_project.create_with_rooms(db_session, obj_in=project_in)


@router.put(
    "/{project_id}",
    summary="Update Estimate Project",
    response_description="Updated estimate project",
    response_model=schemas.EstimateProject,
    dependencies=[Depends(permissions.update())],
)
def update_estimate_project(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    project_in: EstimateProjectUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an existing estimate project."""
    project = crud_util_project.get_object_or_raise_exception(
        db_session, object_id=project_id
    )
    crud.estimate_project.update(db_session, db_obj=project, obj_in=project_in)
    return crud.estimate_project.get_with_details(db_session, obj_id=project_id)


@router.delete(
    "/{project_id}",
    summary="Remove Estimate Project",
    response_description="Project removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def remove_estimate_project(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Soft-delete an estimate project."""
    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)
    crud.estimate_project.remove(db_session, obj_id=project_id)
    return {"msg": "Estimate project deleted successfully."}


# ──────────────────────────────────────────────────
# Rooms (nested under projects)
# ──────────────────────────────────────────────────

@router.post(
    "/{project_id}/rooms",
    summary="Add Room to Estimate Project",
    response_description="Newly created room",
    response_model=schemas.EstimateRoom,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_room(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    room_in: EstimateRoomCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Add a room to an estimate project, optionally with line items."""
    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    with db_session as session:
        room = EstimateRoom(
            name=room_in.name,
            room_type=room_in.room_type,
            floor_level=room_in.floor_level,
            notes=room_in.notes,
            project_id=project_id,
        )
        session.add(room)
        session.flush()

        if room_in.line_items:
            for item_in in room_in.line_items:
                line_item = EstimateLineItem(
                    description=item_in.description,
                    quantity=item_in.quantity,
                    unit=item_in.unit,
                    unit_cost=item_in.unit_cost,
                    total_cost=item_in.total_cost,
                    notes=item_in.notes,
                    category=item_in.category,
                    room_id=room.id,
                )
                session.add(line_item)

        session.commit()
        room_id = room.id

    return crud.estimate_room.get_with_details(db_session, obj_id=room_id)


@router.put(
    "/rooms/{room_id}",
    summary="Update Room",
    response_description="Updated room",
    response_model=schemas.EstimateRoom,
    dependencies=[Depends(permissions.update())],
)
def update_room(
    room_id: Annotated[UUID, Path(description="The room UUID.")],
    room_in: EstimateRoomUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an existing room."""
    room = crud_util_room.get_object_or_raise_exception(db_session, object_id=room_id)
    crud.estimate_room.update(db_session, db_obj=room, obj_in=room_in)
    return crud.estimate_room.get_with_details(db_session, obj_id=room_id)


@router.delete(
    "/rooms/{room_id}",
    summary="Remove Room",
    response_description="Room removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def remove_room(
    room_id: Annotated[UUID, Path(description="The room UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Hard-delete a room and its line items."""
    crud_util_room.get_object_or_raise_exception(db_session, object_id=room_id)
    crud.estimate_room.hard_remove(db_session, obj_id=room_id)
    return {"msg": "Room deleted successfully."}


# ──────────────────────────────────────────────────
# Line Items (nested under rooms)
# ──────────────────────────────────────────────────

@router.post(
    "/rooms/{room_id}/line-items",
    summary="Add Line Item to Room",
    response_description="Newly created line item",
    response_model=schemas.EstimateLineItem,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_line_item(
    room_id: Annotated[UUID, Path(description="The room UUID.")],
    item_in: EstimateLineItemCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Add a line item to a room."""
    crud_util_room.get_object_or_raise_exception(db_session, object_id=room_id)

    with db_session as session:
        line_item = EstimateLineItem(
            description=item_in.description,
            quantity=item_in.quantity,
            unit=item_in.unit,
            unit_cost=item_in.unit_cost,
            total_cost=item_in.total_cost,
            notes=item_in.notes,
            category=item_in.category,
            room_id=room_id,
        )
        session.add(line_item)
        session.commit()
        li_id = line_item.id

    return crud.estimate_line_item.get(db_session, obj_id=li_id)


@router.put(
    "/line-items/{line_item_id}",
    summary="Update Line Item",
    response_description="Updated line item",
    response_model=schemas.EstimateLineItem,
    dependencies=[Depends(permissions.update())],
)
def update_line_item(
    line_item_id: Annotated[UUID, Path(description="The line item UUID.")],
    item_in: EstimateLineItemUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an existing line item."""
    line_item = crud_util_line_item.get_object_or_raise_exception(
        db_session, object_id=line_item_id
    )
    return crud.estimate_line_item.update(db_session, db_obj=line_item, obj_in=item_in)


@router.delete(
    "/line-items/{line_item_id}",
    summary="Remove Line Item",
    response_description="Line item removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def remove_line_item(
    line_item_id: Annotated[UUID, Path(description="The line item UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Hard-delete a line item."""
    crud_util_line_item.get_object_or_raise_exception(
        db_session, object_id=line_item_id
    )
    crud.estimate_line_item.hard_remove(db_session, obj_id=line_item_id)
    return {"msg": "Line item deleted successfully."}


# ──────────────────────────────────────────────────
# Vision / AI Helpers
# ──────────────────────────────────────────────────


def _openai_is_configured() -> bool:
    """Return True if a real OpenAI API key is present."""
    key = getattr(settings, "AI_ESTIMATE_OPENAI_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _strip_markdown(text: str) -> str:
    """Remove common markdown formatting from AI-generated text."""
    if not text:
        return text
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'(?<!\w)\*(.*?)\*(?!\w)', r'\1', text)
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    return text.strip()


def _extract_s3_key(image_url: str) -> str | None:
    """Extract the S3 object key from a full S3 URL."""
    base_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/"
    if image_url and image_url.startswith(base_url):
        return image_url.replace(base_url, "")
    return None


def _analyze_photos_with_vision(
    photos: list,
    room_names: list[str],
    claim_ctx: dict | None = None,
) -> dict:
    """Send photos to OpenAI Vision and return structured damage detection."""
    if not photos or not _openai_is_configured():
        return {"photos": [], "vision_used": False}

    # Build presigned URLs from S3 keys
    s3_items = []
    photo_map: list[dict] = []
    for i, photo in enumerate(photos):
        image_url = getattr(photo, "image_url", None) or ""
        s3_key = _extract_s3_key(image_url)
        if not s3_key:
            continue
        s3_items.append({"s3_key": s3_key, "name": s3_key.split("/")[-1], "size": 0})
        photo_map.append({"index": i, "photo": photo, "s3_key": s3_key})

    if not s3_items:
        return {"photos": [], "vision_used": False}

    try:
        presigned_urls = S3.get_presigned_urls(
            s3_items,
            expiry_date=(datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%d"),
        )
    except Exception as e:
        logger.warning(f"Failed to get presigned URLs for vision analysis: {e}")
        return {"photos": [], "vision_used": False}

    # Build system prompt
    system_prompt = (
        "You are a property damage assessment AI. Analyze the provided photos "
        "and identify visible damage. Return ONLY valid JSON with this structure:\n"
        '{\n  "photos": [\n    {\n'
        '      "photo_index": 0,\n'
        '      "damage_types": ["fire", "smoke", "water", "mold", "structural"],\n'
        '      "severity": "heavy|moderate|light",\n'
        '      "room_assignment": "Kitchen",\n'
        '      "observations": "Plain text description of damage observed",\n'
        '      "suggested_items": [\n'
        '        {"description": "Remove & replace item", "unit": "SF|LF|EA|HR", '
        '"quantity": 10, "unit_cost": 5.00}\n'
        "      ]\n    }\n  ]\n}\n\n"
        "Rules:\n"
        "- severity: heavy = major structural/fire damage, moderate = significant "
        "but repairable, light = cosmetic/surface damage\n"
        "- room_assignment: match to one of the provided room names if possible\n"
        "- suggested_items: realistic repair line items with standard units and costs\n"
        "- Keep observations as plain text, no markdown formatting\n"
        "- If a photo shows no damage, set damage_types to [] and severity to null"
    )

    # Build user prompt
    room_list_str = ", ".join(room_names) if room_names else "No rooms defined"
    user_text = f"Project rooms: {room_list_str}\n"
    if claim_ctx and claim_ctx.get("has_claim"):
        user_text += f"Smoke level: {claim_ctx.get('smoke_level', 'unknown')}\n"
        user_text += f"Origin area: {claim_ctx.get('origin_area', 'unknown')}\n"
        if claim_ctx.get("has_water_damage"):
            user_text += "Water damage from suppression: Yes\n"
    user_text += f"\nAnalyze the following {len(presigned_urls)} photo(s) for damage:"

    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [{"type": "text", "text": user_text}]},
    ]

    for url_info in presigned_urls:
        messages.append(
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": url_info["url"]}}
                ],
            }
        )

    try:
        client = OpenAI(api_key=settings.AI_ESTIMATE_OPENAI_KEY)
        response = client.chat.completions.create(
            model=settings.AI_ESTIMATE_OPENAI_MODEL,
            messages=messages,
            max_tokens=4096,
            temperature=0.7,
            top_p=0.1,
        )
        raw_text = response.choices[0].message.content or ""
    except Exception as e:
        logger.warning(f"OpenAI Vision call failed: {e}")
        return {"photos": [], "vision_used": False}

    # Parse JSON from response
    try:
        # Strip code fences if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw_text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r'```\s*$', '', cleaned.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned)
        if "photos" not in result:
            result = {"photos": []}
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Vision JSON parse failure: {e}")
        return {"photos": [], "vision_used": False}

    # Strip markdown from all text fields
    for photo_result in result.get("photos", []):
        if "observations" in photo_result:
            photo_result["observations"] = _strip_markdown(photo_result["observations"])
        for item in photo_result.get("suggested_items", []):
            if "description" in item:
                item["description"] = _strip_markdown(item["description"])

    result["vision_used"] = True
    return result


def _match_room_name(ai_room_name: str, project_rooms: list) -> tuple[str | None, str | None]:
    """Fuzzy match an AI room assignment to a project room. Returns (room_id, room_name)."""
    if not ai_room_name:
        return None, None
    ai_lower = ai_room_name.lower().strip()
    for room in project_rooms:
        room_name = (getattr(room, "name", "") or "").lower().strip()
        room_type = (getattr(room, "room_type", "") or "").lower().strip()
        if ai_lower == room_name or ai_lower == room_type:
            return str(room.id), room.name
        if ai_lower in room_name or room_name in ai_lower:
            return str(room.id), room.name
        if ai_lower in room_type or room_type in ai_lower:
            return str(room.id), room.name
    return None, None


def _severity_to_confidence(severity: str | None) -> float:
    """Map vision severity to a base confidence score."""
    mapping = {"heavy": 0.85, "moderate": 0.70, "light": 0.55}
    return mapping.get((severity or "").lower(), 0.60)


# ──────────────────────────────────────────────────
# Suggest Estimate from Photos (template-based)
# ──────────────────────────────────────────────────

FIRE_DAMAGE_TEMPLATES: dict[str, list[dict]] = {
    "kitchen": [
        {"description": "Remove & replace base cabinets", "unit": "LF", "default_qty": 12, "unit_cost": 185.00},
        {"description": "Remove & replace upper cabinets", "unit": "LF", "default_qty": 10, "unit_cost": 165.00},
        {"description": "Remove & replace countertop - laminate", "unit": "LF", "default_qty": 12, "unit_cost": 45.00},
        {"description": "Remove & replace vinyl flooring", "unit": "SF", "default_qty": 120, "unit_cost": 6.50},
        {"description": "Paint walls - 2 coats", "unit": "SF", "default_qty": 320, "unit_cost": 2.25},
        {"description": "Paint ceiling", "unit": "SF", "default_qty": 120, "unit_cost": 2.00},
        {"description": "Smoke/soot cleaning", "unit": "SF", "default_qty": 440, "unit_cost": 3.50},
    ],
    "bathroom": [
        {"description": "Remove & replace vanity with top", "unit": "EA", "default_qty": 1, "unit_cost": 450.00},
        {"description": "Remove & replace toilet", "unit": "EA", "default_qty": 1, "unit_cost": 375.00},
        {"description": "Remove & replace ceramic tile floor", "unit": "SF", "default_qty": 48, "unit_cost": 14.50},
        {"description": "Paint walls - 2 coats", "unit": "SF", "default_qty": 200, "unit_cost": 2.25},
        {"description": "Paint ceiling", "unit": "SF", "default_qty": 48, "unit_cost": 2.00},
        {"description": "Smoke/soot cleaning", "unit": "SF", "default_qty": 248, "unit_cost": 2.50},
    ],
    "bedroom": [
        {"description": "Remove & replace carpet with pad", "unit": "SF", "default_qty": 150, "unit_cost": 5.75},
        {"description": "Paint walls - 2 coats", "unit": "SF", "default_qty": 400, "unit_cost": 2.25},
        {"description": "Paint ceiling", "unit": "SF", "default_qty": 150, "unit_cost": 2.00},
        {"description": "Remove & replace baseboard", "unit": "LF", "default_qty": 50, "unit_cost": 5.50},
        {"description": "Smoke/soot cleaning", "unit": "SF", "default_qty": 550, "unit_cost": 1.75},
        {"description": "Remove & replace closet door - bi-fold", "unit": "EA", "default_qty": 1, "unit_cost": 225.00},
    ],
    "living_room": [
        {"description": "Remove & replace carpet with pad", "unit": "SF", "default_qty": 250, "unit_cost": 5.75},
        {"description": "Paint walls - 2 coats", "unit": "SF", "default_qty": 500, "unit_cost": 2.25},
        {"description": "Paint ceiling", "unit": "SF", "default_qty": 250, "unit_cost": 2.00},
        {"description": "Remove & replace baseboard", "unit": "LF", "default_qty": 64, "unit_cost": 5.50},
        {"description": "Smoke/soot cleaning", "unit": "SF", "default_qty": 750, "unit_cost": 2.50},
    ],
    "garage": [
        {"description": "Content manipulation / debris removal", "unit": "HR", "default_qty": 8, "unit_cost": 65.00},
        {"description": "Seal concrete floor", "unit": "SF", "default_qty": 400, "unit_cost": 1.25},
        {"description": "Paint walls - 1 coat", "unit": "SF", "default_qty": 600, "unit_cost": 1.50},
        {"description": "Replace garage door", "unit": "EA", "default_qty": 1, "unit_cost": 1200.00},
    ],
    "default": [
        {"description": "Smoke/soot cleaning", "unit": "SF", "default_qty": 200, "unit_cost": 2.50},
        {"description": "Paint walls - 2 coats", "unit": "SF", "default_qty": 300, "unit_cost": 2.25},
        {"description": "Paint ceiling", "unit": "SF", "default_qty": 100, "unit_cost": 2.00},
    ],
}

SMOKE_CLEANING_TIERS: dict[str, float] = {
    "heavy": 3.50,
    "moderate": 2.50,
    "light": 1.75,
}

SUPPLEMENTAL_ITEMS: dict[str, list[dict]] = {
    "water_damage": [
        {"description": "Water extraction", "unit": "SF", "default_qty": 200, "unit_cost": 2.75},
        {"description": "Dehumidification", "unit": "SF", "default_qty": 200, "unit_cost": 1.50},
        {"description": "Remove water-damaged carpet pad", "unit": "SF", "default_qty": 200, "unit_cost": 1.25},
        {"description": "Anti-microbial treatment", "unit": "SF", "default_qty": 200, "unit_cost": 1.85},
    ],
    "mold_damage": [
        {"description": "Mold remediation", "unit": "SF", "default_qty": 200, "unit_cost": 12.50},
        {"description": "HEPA air scrubber", "unit": "EA", "default_qty": 1, "unit_cost": 450.00},
    ],
    "structural_damage": [
        {"description": "Structural framing inspection", "unit": "EA", "default_qty": 1, "unit_cost": 750.00},
        {"description": "Temporary shoring", "unit": "LF", "default_qty": 12, "unit_cost": 35.00},
    ],
    "roof_damage": [
        {"description": "Emergency roof tarp", "unit": "SQ", "default_qty": 3, "unit_cost": 185.00},
        {"description": "Roof repair sheathing", "unit": "SF", "default_qty": 64, "unit_cost": 8.50},
    ],
    "content_damage": [
        {"description": "Contents pack-out", "unit": "HR", "default_qty": 8, "unit_cost": 65.00},
        {"description": "Contents cleaning", "unit": "HR", "default_qty": 6, "unit_cost": 55.00},
        {"description": "Contents inventory", "unit": "HR", "default_qty": 4, "unit_cost": 55.00},
    ],
    "ordinance_and_law": [
        {"description": "Code upgrade - electrical", "unit": "EA", "default_qty": 1, "unit_cost": 1200.00},
        {"description": "Code upgrade - plumbing", "unit": "EA", "default_qty": 1, "unit_cost": 950.00},
    ],
}


def _infer_category(description: str) -> str:
    """Infer a line item category from its description."""
    desc = description.lower()
    if any(kw in desc for kw in ["cabinet", "countertop", "vanity"]):
        return "cabinets"
    if any(kw in desc for kw in ["floor", "carpet", "tile floor", "vinyl", "concrete floor"]):
        return "floor"
    if "ceiling" in desc:
        return "ceiling"
    if any(kw in desc for kw in ["wall", "paint wall", "drywall"]):
        return "walls"
    if any(kw in desc for kw in ["baseboard", "trim", "molding", "casing"]):
        return "trim"
    if any(kw in desc for kw in ["door", "garage door"]):
        return "doors"
    if "window" in desc:
        return "windows"
    if any(kw in desc for kw in ["toilet", "sink", "faucet", "light", "fixture"]):
        return "fixtures"
    if any(kw in desc for kw in ["water extract", "dehumidif", "anti-microbial"]):
        return "water_mitigation"
    if any(kw in desc for kw in ["mold", "hepa"]):
        return "mold_remediation"
    if any(kw in desc for kw in ["structural", "shoring", "framing"]):
        return "structural"
    if any(kw in desc for kw in ["roof", "tarp", "sheathing"]):
        return "roofing"
    if any(kw in desc for kw in ["content", "pack-out", "inventory"]):
        return "contents"
    if any(kw in desc for kw in ["code upgrade"]):
        return "code_upgrade"
    if any(kw in desc for kw in ["smoke", "soot", "cleaning"]):
        return "cleaning"
    return "misc_items"


def _compute_room_dims(room) -> dict:
    """Compute room dimensions from measurements. Returns dict with None values if unavailable."""
    dims: dict = {
        "length": None,
        "width": None,
        "height": None,
        "floor_sf": None,
        "ceiling_sf": None,
        "wall_sf": None,
        "perimeter_lf": None,
    }

    if not hasattr(room, "measurements") or not room.measurements:
        return dims

    for m in room.measurements:
        length = getattr(m, "length", None)
        width = getattr(m, "width", None)
        height = getattr(m, "height", None)

        if length and width and length > 0 and width > 0:
            dims["length"] = length
            dims["width"] = width
            dims["floor_sf"] = round(length * width, 2)
            dims["ceiling_sf"] = dims["floor_sf"]
            dims["perimeter_lf"] = round(2 * (length + width), 2)

            if height and height > 0:
                dims["height"] = height
                dims["wall_sf"] = round(dims["perimeter_lf"] * height, 2)

            break

    return dims


def _calc_quantity(template_item: dict, room_dims: dict) -> float:
    """Calculate quantity using room dimensions and description keywords."""
    unit = template_item["unit"]
    default_qty = template_item["default_qty"]
    desc = template_item["description"].lower()

    if unit == "SF":
        if any(kw in desc for kw in ["wall", "drywall"]):
            return room_dims["wall_sf"] or room_dims["floor_sf"] or default_qty
        if "ceiling" in desc:
            return room_dims["ceiling_sf"] or default_qty
        if any(kw in desc for kw in ["floor", "carpet", "tile", "vinyl"]):
            return room_dims["floor_sf"] or default_qty
        # Generic SF: use floor_sf as fallback
        return room_dims["floor_sf"] or default_qty
    if unit == "LF":
        return room_dims["perimeter_lf"] or default_qty

    return default_qty


def _infer_damage_type(description: str) -> str:
    """Infer a damage type from a line item description."""
    desc = description.lower()
    if any(kw in desc for kw in ["fire", "char", "burn", "scorch"]):
        return "fire_damage"
    if any(kw in desc for kw in ["smoke", "soot"]):
        return "smoke_damage"
    if any(kw in desc for kw in ["water", "moisture", "leak", "flood"]):
        return "water_damage"
    if any(kw in desc for kw in ["mold", "mildew", "fungus"]):
        return "mold_damage"
    if any(kw in desc for kw in ["structural", "foundation", "framing", "joist", "beam"]):
        return "structural_damage"
    if any(kw in desc for kw in ["roof", "shingle", "gutter", "tarp", "sheathing"]):
        return "roof_damage"
    if any(kw in desc for kw in ["content", "furniture", "appliance", "personal", "pack-out", "inventory"]):
        return "content_damage"
    return "fire_damage"


def _build_claim_context(fire_claim) -> dict:
    """Extract fire claim questionnaire data into a normalized context dict."""
    if not fire_claim:
        return {
            "smoke_level": "moderate",
            "has_water_damage": False,
            "has_roof_damage": False,
            "origin_area": None,
            "rooms_affected_list": [],
            "has_claim": False,
        }

    smoke_level = (getattr(fire_claim, "smoke_level", None) or "moderate").lower().strip()
    if smoke_level not in ("none", "light", "moderate", "heavy"):
        smoke_level = "moderate"

    origin_area = getattr(fire_claim, "origin_area", None)
    if origin_area:
        origin_area = origin_area.lower().strip()
        if origin_area == "other":
            origin_area = (getattr(fire_claim, "origin_area_other", None) or "").lower().strip() or None

    rooms_affected_raw = getattr(fire_claim, "rooms_affected", None) or ""
    rooms_affected_list = [
        r.strip().lower()
        for r in rooms_affected_raw.replace(";", ",").split(",")
        if r.strip()
    ]

    return {
        "smoke_level": smoke_level,
        "has_water_damage": bool(getattr(fire_claim, "water_from_suppression", False)),
        "has_roof_damage": bool(getattr(fire_claim, "roof_opened_by_firefighters", False)),
        "origin_area": origin_area,
        "rooms_affected_list": rooms_affected_list,
        "has_claim": True,
    }


def _analyze_photos(photos) -> dict:
    """Scan photo metadata for damage type keywords. Returns damage signals."""
    detected_damage_types: set[str] = set()
    photo_count = 0
    has_damage_photos = False

    keyword_map = {
        "fire_damage": ["fire", "burn", "char", "scorch"],
        "smoke_damage": ["smoke", "soot"],
        "water_damage": ["water", "flood", "wet", "leak"],
        "mold_damage": ["mold", "mildew"],
        "structural_damage": ["crack", "collapse", "structural"],
        "roof_damage": ["roof", "shingle"],
        "content_damage": ["content", "furniture", "appliance"],
    }

    if not photos:
        return {
            "detected_damage_types": set(),
            "photo_count": 0,
            "has_damage_photos": False,
        }

    for photo in photos:
        photo_count += 1
        searchable = " ".join(
            filter(None, [
                getattr(photo, "caption", None),
                getattr(photo, "photo_type", None),
                getattr(photo, "ai_tags", None),
            ])
        ).lower()

        if not searchable:
            continue

        for damage_type, keywords in keyword_map.items():
            if any(kw in searchable for kw in keywords):
                detected_damage_types.add(damage_type)
                has_damage_photos = True

    return {
        "detected_damage_types": detected_damage_types,
        "photo_count": photo_count,
        "has_damage_photos": has_damage_photos,
    }


def _get_policy_context(db_session: Session, fire_claim) -> dict:
    """Query policy document and intelligence for coverage context."""
    result = {
        "has_policy": False,
        "coverage_a_dwelling": None,
        "coverage_c_personal_property": None,
        "coverage_d_loss_of_use": None,
        "deductible_amount": None,
        "replacement_cost": False,
        "ordinance_and_law": False,
    }

    if not fire_claim:
        return result

    fire_claim_id = getattr(fire_claim, "id", None)
    if not fire_claim_id:
        return result

    policy_doc = (
        db_session.query(PolicyDocument)
        .filter(PolicyDocument.fire_claim_id == fire_claim_id)
        .first()
    )

    if not policy_doc:
        return result

    result["has_policy"] = True

    intel = getattr(policy_doc, "intelligence", None)
    if intel:
        result["coverage_a_dwelling"] = getattr(intel, "coverage_a_dwelling", None)
        result["coverage_c_personal_property"] = getattr(intel, "coverage_c_personal_property", None)
        result["coverage_d_loss_of_use"] = getattr(intel, "coverage_d_loss_of_use", None)
        result["deductible_amount"] = getattr(intel, "deductible_amount", None)

        rcl = getattr(intel, "replacement_cost_language", None)
        result["replacement_cost"] = bool(rcl and rcl.strip())

        oal = getattr(intel, "ordinance_and_law", None)
        result["ordinance_and_law"] = bool(oal and oal.strip())

    return result


def _compute_confidence(
    room_dims: dict,
    photo_result: dict,
    claim_ctx: dict,
    policy_ctx: dict,
    is_origin_room: bool,
    vision_analyzed: bool = False,
) -> float:
    """Compute a dynamic confidence score based on available data signals."""
    score = 0.40  # base

    has_wall_and_ceiling = room_dims.get("wall_sf") is not None and room_dims.get("ceiling_sf") is not None
    has_floor_only = room_dims.get("floor_sf") is not None and not has_wall_and_ceiling

    if has_wall_and_ceiling:
        score += 0.15
    elif has_floor_only:
        score += 0.08

    if photo_result.get("photo_count", 0) > 0:
        score += 0.05
    if photo_result.get("has_damage_photos", False):
        score += 0.10

    if claim_ctx.get("has_claim") and claim_ctx.get("smoke_level") != "moderate":
        score += 0.05

    if policy_ctx.get("has_policy"):
        score += 0.05

    if is_origin_room:
        score += 0.10

    if vision_analyzed:
        score += 0.15

    return min(round(score, 2), 0.95)


def _has_similar_description(suggestions: list[dict], description: str) -> bool:
    """Check if a similar description already exists in the suggestions list."""
    desc_lower = description.lower()
    for sug in suggestions:
        if desc_lower in sug["description"].lower() or sug["description"].lower() in desc_lower:
            return True
    return False


@router.post(
    "/{project_id}/analyze",
    summary="AI Damage Analysis (preview)",
    response_description="Suggested line items grouped by room without saving",
    dependencies=[Depends(permissions.read())],
)
def analyze_for_scope(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return AI-generated scope suggestions grouped by room without persisting to DB."""
    project = crud.estimate_project.get_with_details(db_session, obj_id=project_id)
    if not project:
        crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    # ── Gather contextual data ──
    fire_claim = getattr(project, "fire_claim", None)
    claim_ctx = _build_claim_context(fire_claim)
    policy_ctx = _get_policy_context(db_session, fire_claim)

    project_photos = getattr(project, "photos", None) or []
    project_photo_result = _analyze_photos(project_photos)

    total_photo_count = project_photo_result["photo_count"]
    all_detected_damage: set[str] = set(project_photo_result["detected_damage_types"])

    # ── Optional Vision analysis ──
    vision_used = False
    all_photos_for_vision = list(project_photos)
    for rm in project.rooms:
        all_photos_for_vision.extend(getattr(rm, "photos", None) or [])

    if _openai_is_configured() and all_photos_for_vision:
        try:
            room_names = [r.name or "" for r in project.rooms]
            vision_result = _analyze_photos_with_vision(all_photos_for_vision, room_names, claim_ctx)
            vision_used = vision_result.get("vision_used", False)
        except Exception as e:
            logger.warning(f"Vision analysis failed in analyze_for_scope: {e}")
            vision_used = False

    # ── Process rooms ──
    rooms_result = []
    grand_total = 0.0
    measurement_room_count = 0

    for room in project.rooms:
        room_type = (room.room_type or "").lower().strip()
        room_name_lower = (room.name or "").lower().strip()
        template_key = room_type if room_type in FIRE_DAMAGE_TEMPLATES else "default"
        templates = FIRE_DAMAGE_TEMPLATES[template_key]

        # Room dimensions
        room_dims = _compute_room_dims(room)
        if room_dims["floor_sf"] is not None:
            measurement_room_count += 1

        # Room-level photo analysis (merge with project-level)
        room_photos = getattr(room, "photos", None) or []
        room_photo_result = _analyze_photos(room_photos)
        total_photo_count += room_photo_result["photo_count"]
        room_damage_types = set(room_photo_result["detected_damage_types"]) | all_detected_damage

        # Determine if origin room or affected room
        is_origin = bool(
            claim_ctx["origin_area"]
            and (
                claim_ctx["origin_area"] in room_name_lower
                or claim_ctx["origin_area"] in room_type
            )
        )

        is_affected = True
        if claim_ctx["rooms_affected_list"]:
            is_affected = any(
                affected in room_name_lower or affected in room_type
                for affected in claim_ctx["rooms_affected_list"]
            )
            # Origin room is always affected
            if is_origin:
                is_affected = True

        # Merge photo + claim signals into combined damage set
        combined_damage: set[str] = set()
        if claim_ctx["has_water_damage"] or "water_damage" in room_damage_types:
            combined_damage.add("water_damage")
        if claim_ctx["has_roof_damage"] or "roof_damage" in room_damage_types:
            combined_damage.add("roof_damage")
        if "mold_damage" in room_damage_types:
            combined_damage.add("mold_damage")
        if "structural_damage" in room_damage_types:
            combined_damage.add("structural_damage")
        if "content_damage" in room_damage_types:
            combined_damage.add("content_damage")

        # Compute confidence
        merged_photo = {
            "photo_count": project_photo_result["photo_count"] + room_photo_result["photo_count"],
            "has_damage_photos": project_photo_result["has_damage_photos"] or room_photo_result["has_damage_photos"],
        }
        base_confidence = _compute_confidence(room_dims, merged_photo, claim_ctx, policy_ctx, is_origin, vision_analyzed=vision_used)

        suggestions = []
        damage_types_set: set[str] = set()

        # ── Non-affected rooms: smoke-only scope ──
        if not is_affected:
            if claim_ctx["smoke_level"] != "none":
                smoke_rate = SMOKE_CLEANING_TIERS.get(claim_ctx["smoke_level"], 2.50)
                smoke_desc = f"Smoke/soot cleaning - {claim_ctx['smoke_level']}"
                qty = _calc_quantity(
                    {"description": smoke_desc, "unit": "SF", "default_qty": 200},
                    room_dims,
                )
                total = round(qty * smoke_rate, 2)
                reduced_conf = round(base_confidence * 0.6, 2)
                suggestions.append({
                    "description": smoke_desc,
                    "quantity": qty,
                    "unit": "SF",
                    "unit_price": smoke_rate,
                    "total": total,
                    "category": "cleaning",
                    "confidence": reduced_conf,
                    "damage_type": "smoke_damage",
                })
                damage_types_set.add("smoke_damage")
                grand_total += total

            rooms_result.append({
                "room_id": str(room.id),
                "room_name": room.name,
                "room_type": room.room_type,
                "damage_types": sorted(damage_types_set),
                "suggestions": suggestions,
            })
            continue

        # ── Affected rooms: full template + supplementals ──
        for tmpl in templates:
            desc = tmpl["description"]
            desc_lower = desc.lower()

            # Swap smoke cleaning tier based on claim context
            if "smoke" in desc_lower and "cleaning" in desc_lower:
                if claim_ctx["smoke_level"] == "none":
                    continue  # skip smoke items entirely
                smoke_rate = SMOKE_CLEANING_TIERS.get(claim_ctx["smoke_level"], tmpl["unit_cost"])
                tier_label = claim_ctx["smoke_level"] if claim_ctx["has_claim"] else "moderate"
                desc = f"Smoke/soot cleaning - {tier_label}"
                unit_cost = smoke_rate
            else:
                unit_cost = tmpl["unit_cost"]

            qty = _calc_quantity(
                {"description": desc, "unit": tmpl["unit"], "default_qty": tmpl["default_qty"]},
                room_dims,
            )
            total = round(qty * unit_cost, 2)
            category = _infer_category(desc)
            damage_type = _infer_damage_type(desc)
            damage_types_set.add(damage_type)

            suggestions.append({
                "description": desc,
                "quantity": qty,
                "unit": tmpl["unit"],
                "unit_price": unit_cost,
                "total": total,
                "category": category,
                "confidence": base_confidence,
                "damage_type": damage_type,
            })
            grand_total += total

        # ── Add supplemental items ──
        supplemental_confidence = round(base_confidence * 0.85, 2)

        # Water damage items
        if "water_damage" in combined_damage:
            for item in SUPPLEMENTAL_ITEMS["water_damage"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = _calc_quantity(item, room_dims)
                    total = round(qty * item["unit_cost"], 2)
                    damage_types_set.add("water_damage")
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "water_damage",
                    })
                    grand_total += total

        # Mold damage items (from photos only)
        if "mold_damage" in combined_damage:
            for item in SUPPLEMENTAL_ITEMS["mold_damage"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = _calc_quantity(item, room_dims)
                    total = round(qty * item["unit_cost"], 2)
                    damage_types_set.add("mold_damage")
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "mold_damage",
                    })
                    grand_total += total

        # Structural items (origin room or photo-detected)
        if is_origin or "structural_damage" in combined_damage:
            for item in SUPPLEMENTAL_ITEMS["structural_damage"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = _calc_quantity(item, room_dims)
                    total = round(qty * item["unit_cost"], 2)
                    damage_types_set.add("structural_damage")
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "structural_damage",
                    })
                    grand_total += total

        # Roof damage items
        if "roof_damage" in combined_damage and is_origin:
            for item in SUPPLEMENTAL_ITEMS["roof_damage"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = item["default_qty"]  # roof items use fixed defaults
                    total = round(qty * item["unit_cost"], 2)
                    damage_types_set.add("roof_damage")
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "roof_damage",
                    })
                    grand_total += total

        # Content damage items (only if policy has Coverage C)
        if "content_damage" in combined_damage and policy_ctx.get("coverage_c_personal_property"):
            for item in SUPPLEMENTAL_ITEMS["content_damage"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = item["default_qty"]
                    total = round(qty * item["unit_cost"], 2)
                    damage_types_set.add("content_damage")
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "content_damage",
                    })
                    grand_total += total

        # Ordinance & law items (origin room + policy has O&L)
        if is_origin and policy_ctx.get("ordinance_and_law"):
            for item in SUPPLEMENTAL_ITEMS["ordinance_and_law"]:
                if not _has_similar_description(suggestions, item["description"]):
                    qty = item["default_qty"]
                    total = round(qty * item["unit_cost"], 2)
                    suggestions.append({
                        "description": item["description"],
                        "quantity": qty,
                        "unit": item["unit"],
                        "unit_price": item["unit_cost"],
                        "total": total,
                        "category": _infer_category(item["description"]),
                        "confidence": supplemental_confidence,
                        "damage_type": "fire_damage",
                    })
                    grand_total += total

        rooms_result.append({
            "room_id": str(room.id),
            "room_name": room.name,
            "room_type": room.room_type,
            "damage_types": sorted(damage_types_set),
            "suggestions": suggestions,
        })

    # ── Build response metadata ──
    metadata = {
        "inputs_used": {
            "measurements": measurement_room_count > 0,
            "photos": total_photo_count > 0,
            "fire_claim": claim_ctx["has_claim"],
            "policy": policy_ctx["has_policy"],
            "vision": vision_used,
        },
        "measurement_rooms": measurement_room_count,
        "photo_count": total_photo_count,
        "smoke_level": claim_ctx["smoke_level"],
        "origin_area": claim_ctx["origin_area"],
        "water_damage_indicated": claim_ctx["has_water_damage"] or "water_damage" in all_detected_damage,
        "roof_damage_indicated": claim_ctx["has_roof_damage"] or "roof_damage" in all_detected_damage,
        "policy_coverage_a": policy_ctx.get("coverage_a_dwelling"),
        "policy_deductible": policy_ctx.get("deductible_amount"),
    }

    return {
        "rooms": rooms_result,
        "total_estimated": round(grand_total, 2),
        "metadata": metadata,
    }


@router.post(
    "/{project_id}/analyze-photos",
    summary="Analyze Photos with AI Vision",
    response_description="Per-photo damage detection and suggested scope items",
    dependencies=[Depends(permissions.read())],
)
def analyze_photos(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Analyze project photos with OpenAI Vision and return damage detection + scope suggestions."""
    project = crud.estimate_project.get_with_details(db_session, obj_id=project_id)
    if not project:
        crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    # Gather all photos (project-level + room-level)
    project_photos = getattr(project, "photos", None) or []
    all_photos = list(project_photos)
    for room in project.rooms:
        all_photos.extend(getattr(room, "photos", None) or [])

    if not all_photos:
        return {
            "rooms": [],
            "total_estimated": 0.0,
            "metadata": {
                "inputs_used": {"measurements": False, "photos": False, "fire_claim": False, "policy": False, "vision": False},
                "photo_count": 0,
                "photo_annotations": [],
            },
        }

    # Gather context
    fire_claim = getattr(project, "fire_claim", None)
    claim_ctx = _build_claim_context(fire_claim)
    policy_ctx = _get_policy_context(db_session, fire_claim)
    room_names = [r.name or "" for r in project.rooms]

    # Try Vision analysis
    vision_result = _analyze_photos_with_vision(all_photos, room_names, claim_ctx)
    vision_used = vision_result.get("vision_used", False)

    # Build photo annotations and scope suggestions
    photo_annotations = []
    rooms_map: dict[str, dict] = {}  # room_id -> {room_name, room_type, suggestions}
    grand_total = 0.0

    if vision_used and vision_result.get("photos"):
        for vp in vision_result["photos"]:
            photo_idx = vp.get("photo_index", 0)
            photo_obj = all_photos[photo_idx] if photo_idx < len(all_photos) else None

            # Build annotation
            annotation = {
                "image_url": getattr(photo_obj, "image_url", "") if photo_obj else "",
                "damage_types": vp.get("damage_types", []),
                "severity": vp.get("severity"),
                "room_assignment": _strip_markdown(vp.get("room_assignment", "")),
                "observations": _strip_markdown(vp.get("observations", "")),
            }
            photo_annotations.append(annotation)

            # Save damage keywords back to photo's ai_tags
            if photo_obj:
                damage_tags = ",".join(vp.get("damage_types", []))
                severity = vp.get("severity", "")
                ai_tags_data = json.dumps({
                    "damage_types": vp.get("damage_types", []),
                    "severity": severity,
                    "observations": vp.get("observations", ""),
                })
                try:
                    photo_obj.ai_tags = ai_tags_data
                    db_session.add(photo_obj)
                except Exception:
                    pass  # non-critical

            # Map suggestions to rooms
            matched_room_id, matched_room_name = _match_room_name(
                vp.get("room_assignment", ""), project.rooms
            )
            if not matched_room_id and project.rooms:
                matched_room_id = str(project.rooms[0].id)
                matched_room_name = project.rooms[0].name

            if matched_room_id and matched_room_id not in rooms_map:
                # Find room type
                room_type = ""
                for rm in project.rooms:
                    if str(rm.id) == matched_room_id:
                        room_type = rm.room_type or ""
                        break
                rooms_map[matched_room_id] = {
                    "room_id": matched_room_id,
                    "room_name": matched_room_name or "Unassigned",
                    "room_type": room_type,
                    "damage_types": set(),
                    "suggestions": [],
                }

            if matched_room_id:
                room_entry = rooms_map[matched_room_id]
                for dt in vp.get("damage_types", []):
                    room_entry["damage_types"].add(f"{dt}_damage" if not dt.endswith("_damage") else dt)

                confidence = _severity_to_confidence(vp.get("severity"))
                for item in vp.get("suggested_items", []):
                    desc = _strip_markdown(item.get("description", ""))
                    if not desc:
                        continue
                    if _has_similar_description(room_entry["suggestions"], desc):
                        continue
                    qty = item.get("quantity", 1)
                    unit_cost = item.get("unit_cost", 0)
                    total = round(qty * unit_cost, 2)
                    room_entry["suggestions"].append({
                        "description": desc,
                        "quantity": qty,
                        "unit": item.get("unit", "EA"),
                        "unit_price": unit_cost,
                        "total": total,
                        "category": _infer_category(desc),
                        "confidence": confidence,
                        "damage_type": vp.get("damage_types", ["fire"])[0] + "_damage" if vp.get("damage_types") else "fire_damage",
                    })
                    grand_total += total

        try:
            db_session.commit()
        except Exception:
            db_session.rollback()

    else:
        # Fallback: use template-based scope via existing metadata analysis
        project_photo_result = _analyze_photos(all_photos)
        for room in project.rooms:
            room_type = (room.room_type or "").lower().strip()
            template_key = room_type if room_type in FIRE_DAMAGE_TEMPLATES else "default"
            templates = FIRE_DAMAGE_TEMPLATES[template_key]
            room_dims = _compute_room_dims(room)

            suggestions = []
            damage_types_set: set[str] = set()
            base_confidence = _compute_confidence(
                room_dims, project_photo_result, claim_ctx, policy_ctx, False
            )

            for tmpl in templates:
                desc = tmpl["description"]
                qty = _calc_quantity(tmpl, room_dims)
                total = round(qty * tmpl["unit_cost"], 2)
                category = _infer_category(desc)
                damage_type = _infer_damage_type(desc)
                damage_types_set.add(damage_type)
                suggestions.append({
                    "description": _strip_markdown(desc),
                    "quantity": qty,
                    "unit": tmpl["unit"],
                    "unit_price": tmpl["unit_cost"],
                    "total": total,
                    "category": category,
                    "confidence": base_confidence,
                    "damage_type": damage_type,
                })
                grand_total += total

            rooms_map[str(room.id)] = {
                "room_id": str(room.id),
                "room_name": room.name,
                "room_type": room.room_type,
                "damage_types": damage_types_set,
                "suggestions": suggestions,
            }

    # Build final response (same format as analyze_for_scope)
    rooms_result = []
    for room_data in rooms_map.values():
        rooms_result.append({
            "room_id": room_data["room_id"],
            "room_name": room_data["room_name"],
            "room_type": room_data["room_type"],
            "damage_types": sorted(room_data["damage_types"]),
            "suggestions": room_data["suggestions"],
        })

    metadata = {
        "inputs_used": {
            "measurements": False,
            "photos": len(all_photos) > 0,
            "fire_claim": claim_ctx.get("has_claim", False),
            "policy": policy_ctx.get("has_policy", False),
            "vision": vision_used,
        },
        "photo_count": len(all_photos),
        "photo_annotations": photo_annotations,
    }

    return {
        "rooms": rooms_result,
        "total_estimated": round(grand_total, 2),
        "metadata": metadata,
    }


@router.post(
    "/{project_id}/suggest",
    summary="Suggest Estimate from Photos",
    response_description="Project with AI-suggested line items",
    response_model=schemas.EstimateProject,
    dependencies=[Depends(permissions.create())],
)
def suggest_estimate_from_photos(
    project_id: Annotated[UUID, Path(description="The estimate project UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Generate suggested line items based on room types and uploaded photos."""
    project = crud.estimate_project.get_with_details(db_session, obj_id=project_id)
    if not project:
        crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    created_count = 0

    with db_session as session:
        for room in project.rooms:
            room_type = (room.room_type or "").lower().strip()
            template_key = room_type if room_type in FIRE_DAMAGE_TEMPLATES else "default"
            templates = FIRE_DAMAGE_TEMPLATES[template_key]
            room_dims = _compute_room_dims(room)

            for tmpl in templates:
                qty = _calc_quantity(tmpl, room_dims)
                unit_cost = tmpl["unit_cost"]
                total_cost = round(qty * unit_cost, 2)

                line_item = EstimateLineItem(
                    description=tmpl["description"],
                    quantity=qty,
                    unit=tmpl["unit"],
                    unit_cost=unit_cost,
                    total_cost=total_cost,
                    status="suggested",
                    source="ai",
                    confidence=0.7,
                    category=_infer_category(tmpl["description"]),
                    room_id=room.id,
                )
                session.add(line_item)
                created_count += 1

        session.commit()

    return crud.estimate_project.get_with_details(db_session, obj_id=project_id)


# ──────────────────────────────────────────────────
# Approve / Reject Suggested Line Items
# ──────────────────────────────────────────────────

@router.put(
    "/line-items/{line_item_id}/approve",
    summary="Approve Suggested Line Item",
    response_description="Approved line item",
    response_model=schemas.EstimateLineItem,
    dependencies=[Depends(permissions.update())],
)
def approve_line_item(
    line_item_id: Annotated[UUID, Path(description="The line item UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Approve a suggested line item."""
    line_item = crud_util_line_item.get_object_or_raise_exception(
        db_session, object_id=line_item_id
    )
    return crud.estimate_line_item.update(
        db_session,
        db_obj=line_item,
        obj_in=EstimateLineItemUpdate(status="approved"),
    )


@router.delete(
    "/line-items/{line_item_id}/reject",
    summary="Reject Suggested Line Item",
    response_description="Line item rejected and removed",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def reject_line_item(
    line_item_id: Annotated[UUID, Path(description="The line item UUID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Reject and remove a suggested line item."""
    crud_util_line_item.get_object_or_raise_exception(
        db_session, object_id=line_item_id
    )
    crud.estimate_line_item.hard_remove(db_session, obj_id=line_item_id)
    return {"msg": "Suggested line item rejected and removed."}
