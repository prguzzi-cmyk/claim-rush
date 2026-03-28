#!/usr/bin/env python

"""Routes for the Fire Claims module"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from openai import OpenAI
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.schemas.estimate_project import EstimateProject as EstimateProjectSchema
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

logger = logging.getLogger(__name__)

router = APIRouter()

module = Modules.FIRE_CLAIM
permissions = Permissions(module.value)
crud_util = CrudUtil(crud.fire_claim)


@router.get(
    "",
    summary="List Fire Claims",
    response_description="Paginated list of fire claims",
    response_model=CustomPage[schemas.FireClaim],
    dependencies=[Depends(permissions.read())],
)
def list_fire_claims(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a paginated list of fire claims."""
    return crud.fire_claim.get_multi(db_session)


@router.post(
    "",
    summary="Create Fire Claim",
    response_description="Newly created fire claim",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_fire_claim(
    fire_claim_in: schemas.FireClaimCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new fire claim."""
    UserContext.set(current_user.id)
    return crud.fire_claim.create(db_session, obj_in=fire_claim_in)


@router.get(
    "/{fire_claim_id}",
    summary="Get Fire Claim",
    response_description="Fire claim details with media",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.read())],
)
def get_fire_claim(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a fire claim by ID."""
    return crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )


@router.put(
    "/{fire_claim_id}",
    summary="Update Fire Claim",
    response_description="Updated fire claim",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.update())],
)
def update_fire_claim(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    fire_claim_in: schemas.FireClaimUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update an existing fire claim."""
    UserContext.set(current_user.id)
    fire_claim = crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )
    return crud.fire_claim.update(db_session, db_obj=fire_claim, obj_in=fire_claim_in)


@router.post(
    "/{fire_claim_id}/mark-complete",
    summary="Mark Fire Claim Intake Complete",
    response_description="Updated fire claim",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.update())],
)
def mark_fire_claim_complete(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Set fire claim status to intake_complete."""
    UserContext.set(current_user.id)
    fire_claim = crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )
    return crud.fire_claim.mark_complete(db_session, db_obj=fire_claim)


@router.post(
    "/{fire_claim_id}/estimate",
    summary="Get or Create Estimate for Fire Claim",
    response_description="The linked estimate project",
    response_model=EstimateProjectSchema,
    dependencies=[Depends(permissions.update())],
)
def get_or_create_estimate(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Return the linked estimate project for a fire claim, creating one if needed."""
    UserContext.set(current_user.id)
    fire_claim = crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )

    if fire_claim.estimate_project_id:
        project = crud.estimate_project.get_with_details(
            db_session, obj_id=fire_claim.estimate_project_id
        )
        if project:
            return project

    # Create a new estimate project
    loss_date_str = fire_claim.loss_date.strftime("%m/%d/%Y") if fire_claim.loss_date else ""
    project_name = f"Estimate – {fire_claim.address_line1}, {fire_claim.city} – {loss_date_str}"

    from app.schemas.estimate_project import EstimateProjectCreate

    project_in = EstimateProjectCreate(name=project_name)
    project = crud.estimate_project.create_with_rooms(db_session, obj_in=project_in)

    # Link fire claim to the new project
    fire_claim.estimate_project_id = project.id
    db_session.add(fire_claim)
    db_session.commit()

    # Re-fetch to include the fire_claim backref
    return crud.estimate_project.get_with_details(db_session, obj_id=project.id)


def _openai_is_configured() -> bool:
    """Return True if a real OpenAI API key is present."""
    key = getattr(settings, "AI_ESTIMATE_OPENAI_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _generate_template_analysis(fire_claim: models.FireClaim) -> str:
    """Build a structured analysis from claim fields when OpenAI is unavailable."""
    origin = fire_claim.origin_area or "Unknown"
    rooms = fire_claim.rooms_affected or "Not specified"
    smoke = fire_claim.smoke_level or "Unknown"
    water = "Yes" if fire_claim.water_from_suppression else "No"
    roof = "Yes" if fire_claim.roof_opened_by_firefighters else "No"
    power = "Yes" if fire_claim.power_shut_off else "No"
    notes = fire_claim.notes or "None"
    photo_count = sum(1 for m in fire_claim.media if m.media_type == "photo")

    smoke_detail = {
        "none": "No smoke damage reported. Minimal remediation expected.",
        "light": "Light smoke present — may require surface cleaning and deodorization of affected rooms.",
        "moderate": "Moderate smoke damage — likely requires professional cleaning, HVAC duct inspection, and possible repainting of affected areas.",
        "heavy": "Heavy smoke damage — expect soot deposits on walls/ceilings, compromised soft goods, and HVAC contamination. Professional remediation recommended.",
        "severe": "Severe smoke damage throughout — structural smoke penetration likely. Full professional remediation, air quality testing, and content cleaning/replacement expected.",
    }.get(smoke.lower(), f"Smoke level reported as '{smoke}' — on-site assessment recommended.")

    water_detail = (
        "Water from fire suppression was reported. Inspect for standing water, saturated drywall, "
        "flooring damage, and potential mold risk. Moisture mapping recommended within 48 hours."
        if fire_claim.water_from_suppression
        else "No water from suppression reported. Verify on-site that no secondary water damage exists."
    )

    roof_detail = (
        "Roof was opened by firefighters for ventilation. Inspect for structural integrity of "
        "roof decking, weather exposure damage, and temporary tarping needs."
        if fire_claim.roof_opened_by_firefighters
        else "Roof was not opened by firefighters. Standard exterior inspection applies."
    )

    sections = [
        "CLAIM INTELLIGENCE ENGINE\u2122 REPORT",
        "Fire Damage Assessment",
        "=" * 40,
        "",
        "ORIGIN ASSESSMENT",
        f"  Reported area of origin: {origin}",
        f"  The fire reportedly originated in the {origin} area.",
        f"  Rooms affected: {rooms}",
        "  On-site origin confirmation and cause determination recommended.",
        "",
        "STRUCTURAL DAMAGE INDICATORS",
        f"  Based on the reported smoke level ({smoke}) and affected rooms ({rooms}),",
        "  structural inspection should focus on:",
        "  - Load-bearing walls and ceiling joists in/near the origin area",
        "  - Heat damage to structural framing and connectors",
        f"  - {'Roof structure integrity (roof was ventilated by firefighters)' if fire_claim.roof_opened_by_firefighters else 'Standard roof and attic inspection'}",
        f"  - {'Electrical system (power was shut off — inspect panel and wiring)' if fire_claim.power_shut_off else 'Electrical system spot-check in affected areas'}",
        "",
        "SMOKE DAMAGE ASSESSMENT",
        f"  Reported smoke level: {smoke}",
        f"  {smoke_detail}",
        "",
        "WATER DAMAGE ASSESSMENT",
        f"  Water from suppression: {water}",
        f"  {water_detail}",
        "",
        "ROOF & VENTILATION",
        f"  Roof opened by firefighters: {roof}",
        f"  {roof_detail}",
        "",
        "SAFETY HAZARDS",
        f"  - Power shut off: {power}",
        "  - Verify structural stability before full interior inspection",
        "  - Check for hazardous materials (asbestos, lead paint) if pre-1980 construction",
        "  - Confirm gas lines are isolated if applicable",
        "",
        "ADDITIONAL NOTES",
        f"  {notes}",
        "",
        "RECOMMENDED NEXT STEPS",
        "  1. Schedule on-site inspection to confirm origin and assess structural damage",
        "  2. Engage certified fire restoration contractor for scope of work",
        f"  3. {'Order moisture mapping and mold prevention protocol' if fire_claim.water_from_suppression else 'Verify no hidden water intrusion'}",
        f"  4. {'Arrange emergency tarping for roof opening' if fire_claim.roof_opened_by_firefighters else 'Standard exterior weatherproofing review'}",
        f"  5. {'Electrical system evaluation before power restoration' if fire_claim.power_shut_off else 'Spot-check electrical in affected zones'}",
        f"  6. Document all damage with photos ({photo_count} photo(s) currently on file)",
    ]

    # --- FIRE DAMAGE REPAIR SCOPE (room-by-room) ---
    room_labels = {
        "kitchen": "Kitchen",
        "living_room": "Living Room",
        "dining_room": "Dining Room",
        "bedroom": "Bedroom",
        "bathroom": "Bathroom",
        "garage": "Garage",
        "attic": "Attic",
        "basement": "Basement",
        "exterior": "Exterior",
        "hallway": "Hallway",
        "laundry": "Laundry Room",
        "office": "Office",
    }
    smoke_lower = smoke.lower()
    is_origin = lambda r: r.strip().lower() == origin.lower()
    has_water = fire_claim.water_from_suppression

    room_list = [r.strip() for r in rooms.split(",") if r.strip()]

    sections.append("")
    sections.append("FIRE DAMAGE REPAIR SCOPE")
    sections.append("-" * 40)

    for room_raw in room_list:
        room_key = room_raw.lower().replace(" ", "_")
        room_name = room_labels.get(room_key, room_raw.title())
        items: list[str] = []

        # Origin room gets structural + fire-direct items
        if is_origin(room_raw):
            items.append("Remove and replace fire-damaged drywall and insulation")
            items.append("Inspect and repair/replace structural framing as needed")
            items.append("Replace damaged electrical wiring and outlets")
            items.append("Remove and replace fire-damaged cabinetry and countertops")
            items.append("Replace damaged flooring down to subfloor")
        else:
            # Non-origin rooms get heat/exposure items
            items.append("Inspect drywall and framing for heat damage")

        # Smoke items scale with level
        if smoke_lower == "light":
            items.append("Clean soot from walls and ceilings")
            items.append("Deodorize room and soft contents")
        elif smoke_lower == "moderate":
            items.append("Clean and seal soot-stained walls and ceilings")
            items.append("Prime and repaint all walls and ceilings")
            items.append("Professional deodorization treatment")
            items.append("Clean or replace window treatments")
        elif smoke_lower in ("heavy", "severe"):
            items.append("Strip and replace smoke-damaged drywall")
            items.append("Replace smoke-saturated insulation")
            items.append("Prime and repaint all surfaces")
            items.append("Replace carpet, pad, and soft goods")
            items.append("HVAC duct cleaning and filter replacement")
            items.append("Ozone or hydroxyl deodorization treatment")

        # Water items
        if has_water:
            items.append("Extract standing water and dry affected areas")
            items.append("Remove and replace water-damaged flooring")
            items.append("Inspect for mold growth — treat if present")
            items.append("Replace saturated drywall (lower 2–4 ft)")

        sections.append("")
        sections.append(room_name)
        for item in items:
            sections.append(f"  \u2022 {item}")

    # Closing note
    sections += [
        "",
        "---",
        "Decision support \u2013 field verification required.",
    ]

    return "\n".join(sections)


@router.post(
    "/{fire_claim_id}/analyze",
    summary="Analyze Fire Claim with AI",
    response_description="Fire claim with AI analysis",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.update())],
)
def analyze_fire_damage(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Run AI analysis on a fire claim. Uses OpenAI vision when configured,
    otherwise falls back to a template-based analysis from claim fields."""
    UserContext.set(current_user.id)
    fire_claim = crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )

    photos = [m for m in fire_claim.media if m.media_type == "photo"]

    # --- Try OpenAI vision if configured and photos exist ---
    if _openai_is_configured() and photos:
        presigned_urls = S3.get_presigned_urls(
            [
                {"s3_key": p.storage_key, "name": p.storage_key.split("/")[-1], "size": 0}
                for p in photos
            ],
            expiry_date=(datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%d"),
        )

        system_prompt = (
            "You are an expert fire damage assessment analyst for insurance claims. "
            "Analyze the provided photos and claim context to produce a structured "
            "fire damage report. Be specific, professional, and thorough."
        )

        claim_context = (
            f"Fire Claim Context:\n"
            f"- Area of Origin: {fire_claim.origin_area}\n"
            f"- Rooms Affected: {fire_claim.rooms_affected}\n"
            f"- Smoke Level: {fire_claim.smoke_level}\n"
            f"- Water from Suppression: {'Yes' if fire_claim.water_from_suppression else 'No'}\n"
            f"- Roof Opened by Firefighters: {'Yes' if fire_claim.roof_opened_by_firefighters else 'No'}\n"
            f"- Power Shut Off: {'Yes' if fire_claim.power_shut_off else 'No'}\n"
        )
        if fire_claim.notes:
            claim_context += f"- Additional Notes: {fire_claim.notes}\n"

        user_prompt = (
            f"{claim_context}\n"
            "Based on the claim details and the attached photos, provide a structured "
            "fire damage analysis with the following sections:\n\n"
            "Fire Damage Analysis\n\n"
            "• Probable origin confirmation\n"
            "• Structural damage indicators\n"
            "• Smoke damage spread\n"
            "• Water damage indicators\n"
            "• Safety hazards\n"
            "• Recommended next steps\n"
        )

        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [{"type": "text", "text": user_prompt}]},
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
            analysis_text = response.choices[0].message.content
        except Exception as e:
            logger.warning(
                f"OpenAI unavailable for fire claim {fire_claim_id}, "
                f"falling back to template: {e}"
            )
            analysis_text = _generate_template_analysis(fire_claim)
    else:
        # No OpenAI configured or no photos — use template
        if not _openai_is_configured():
            logger.info(
                f"OpenAI not configured — using template analysis for {fire_claim_id}"
            )
        analysis_text = _generate_template_analysis(fire_claim)

    # Save to claim
    fire_claim.ai_analysis = analysis_text
    fire_claim.ai_analysis_at = datetime.now(timezone.utc)
    db_session.add(fire_claim)
    db_session.commit()
    db_session.refresh(fire_claim)

    return fire_claim


def _generate_carrier_report(fire_claim: models.FireClaim) -> str:
    """Build a carrier-friendly report with neutral titles, no AI/branding references."""
    origin = fire_claim.origin_area or "Unknown"
    rooms = fire_claim.rooms_affected or "Not specified"
    smoke = fire_claim.smoke_level or "Unknown"
    water = "Yes" if fire_claim.water_from_suppression else "No"
    roof = "Yes" if fire_claim.roof_opened_by_firefighters else "No"
    power = "Yes" if fire_claim.power_shut_off else "No"
    notes = fire_claim.notes or "None"

    smoke_detail = {
        "none": "No smoke damage reported. Minimal remediation expected.",
        "light": "Light smoke present — surface cleaning and deodorization of affected rooms recommended.",
        "moderate": "Moderate smoke damage — professional cleaning, HVAC duct inspection, and repainting of affected areas recommended.",
        "heavy": "Heavy smoke damage — soot deposits on walls/ceilings, compromised soft goods, and HVAC contamination. Professional remediation recommended.",
        "severe": "Severe smoke damage throughout — structural smoke penetration likely. Full professional remediation, air quality testing, and content cleaning/replacement expected.",
    }.get(smoke.lower(), f"Smoke level reported as '{smoke}' — on-site assessment recommended.")

    water_detail = (
        "Water from fire suppression was reported. Inspect for standing water, saturated drywall, "
        "flooring damage, and potential mold risk. Moisture mapping recommended within 48 hours."
        if fire_claim.water_from_suppression
        else "No water from suppression reported. Verify on-site that no secondary water damage exists."
    )

    roof_detail = (
        "Roof was opened by firefighters for ventilation. Inspect for structural integrity of "
        "roof decking, weather exposure damage, and temporary tarping needs."
        if fire_claim.roof_opened_by_firefighters
        else "Roof was not opened by firefighters. Standard exterior inspection applies."
    )

    sections = [
        "Preliminary Adjuster Work Product \u2013 Field Verification Required",
        "",
        "FIRE DAMAGE ASSESSMENT",
        "=" * 40,
        "",
        f"Insured: {fire_claim.insured_name}",
        f"Property: {fire_claim.address_line1}, {fire_claim.city}, {fire_claim.state} {fire_claim.zip}",
        f"Loss Date: {fire_claim.loss_date}",
    ]
    if fire_claim.claim_number:
        sections.append(f"Claim #: {fire_claim.claim_number}")
    if fire_claim.carrier_name:
        sections.append(f"Carrier: {fire_claim.carrier_name}")
    if fire_claim.policy_number:
        sections.append(f"Policy #: {fire_claim.policy_number}")

    sections += [
        "",
        "ORIGIN DETERMINATION",
        f"  Reported area of origin: {origin}",
        f"  Rooms affected: {rooms}",
        "  On-site origin confirmation and cause determination recommended.",
        "",
        "STRUCTURAL DAMAGE INDICATORS",
        f"  Based on the reported smoke level ({smoke}) and affected rooms ({rooms}),",
        "  structural inspection should focus on:",
        "  - Load-bearing walls and ceiling joists in/near the origin area",
        "  - Heat damage to structural framing and connectors",
        f"  - {'Roof structure integrity (roof was ventilated by firefighters)' if fire_claim.roof_opened_by_firefighters else 'Standard roof and attic inspection'}",
        f"  - {'Electrical system (power was shut off — inspect panel and wiring)' if fire_claim.power_shut_off else 'Electrical system spot-check in affected areas'}",
        "",
        "SMOKE DAMAGE EVALUATION",
        f"  Reported smoke level: {smoke}",
        f"  {smoke_detail}",
        "",
        "WATER DAMAGE EVALUATION",
        f"  Water from suppression: {water}",
        f"  {water_detail}",
        "",
        "ROOF & VENTILATION",
        f"  Roof opened by firefighters: {roof}",
        f"  {roof_detail}",
        "",
        "SAFETY HAZARDS",
        f"  - Power shut off: {power}",
        "  - Verify structural stability before full interior inspection",
        "  - Check for hazardous materials (asbestos, lead paint) if pre-1980 construction",
        "  - Confirm gas lines are isolated if applicable",
    ]

    if notes != "None":
        sections += ["", "ADJUSTER NOTES", f"  {notes}"]

    # --- RECOMMENDED REPAIR SCOPE (room-by-room) ---
    room_labels = {
        "kitchen": "Kitchen",
        "living_room": "Living Room",
        "dining_room": "Dining Room",
        "bedroom": "Bedroom",
        "bathroom": "Bathroom",
        "garage": "Garage",
        "attic": "Attic",
        "basement": "Basement",
        "exterior": "Exterior",
        "hallway": "Hallway",
        "laundry": "Laundry Room",
        "office": "Office",
    }
    smoke_lower = smoke.lower()
    has_water = fire_claim.water_from_suppression
    room_list = [r.strip() for r in rooms.split(",") if r.strip()]

    sections += ["", "RECOMMENDED REPAIR SCOPE", "-" * 40]

    for room_raw in room_list:
        room_key = room_raw.lower().replace(" ", "_")
        room_name = room_labels.get(room_key, room_raw.title())
        items: list[str] = []

        if room_raw.strip().lower() == origin.lower():
            items.append("Remove and replace fire-damaged drywall and insulation")
            items.append("Inspect and repair/replace structural framing as needed")
            items.append("Replace damaged electrical wiring and outlets")
            items.append("Remove and replace fire-damaged cabinetry and countertops")
            items.append("Replace damaged flooring down to subfloor")
        else:
            items.append("Inspect drywall and framing for heat damage")

        if smoke_lower == "light":
            items.append("Clean soot from walls and ceilings")
            items.append("Deodorize room and soft contents")
        elif smoke_lower == "moderate":
            items.append("Clean and seal soot-stained walls and ceilings")
            items.append("Prime and repaint all walls and ceilings")
            items.append("Professional deodorization treatment")
            items.append("Clean or replace window treatments")
        elif smoke_lower in ("heavy", "severe"):
            items.append("Strip and replace smoke-damaged drywall")
            items.append("Replace smoke-saturated insulation")
            items.append("Prime and repaint all surfaces")
            items.append("Replace carpet, pad, and soft goods")
            items.append("HVAC duct cleaning and filter replacement")
            items.append("Ozone or hydroxyl deodorization treatment")

        if has_water:
            items.append("Extract standing water and dry affected areas")
            items.append("Remove and replace water-damaged flooring")
            items.append("Inspect for mold growth — treat if present")
            items.append("Replace saturated drywall (lower 2–4 ft)")

        sections.append("")
        sections.append(room_name)
        for item in items:
            sections.append(f"  \u2022 {item}")

    sections += [
        "",
        "RECOMMENDED NEXT STEPS",
        "  1. Schedule on-site inspection to confirm origin and assess structural damage",
        "  2. Engage certified fire restoration contractor for scope of work",
        f"  3. {'Order moisture mapping and mold prevention protocol' if fire_claim.water_from_suppression else 'Verify no hidden water intrusion'}",
        f"  4. {'Arrange emergency tarping for roof opening' if fire_claim.roof_opened_by_firefighters else 'Standard exterior weatherproofing review'}",
        f"  5. {'Electrical system evaluation before power restoration' if fire_claim.power_shut_off else 'Spot-check electrical in affected zones'}",
        "",
        "---",
        "Preliminary adjuster work product. Subject to field verification",
        "and on-site inspection. Not a final scope of loss.",
    ]

    return "\n".join(sections)


@router.post(
    "/{fire_claim_id}/carrier-report",
    summary="Generate Carrier Report",
    response_description="Fire claim with carrier report",
    response_model=schemas.FireClaim,
    dependencies=[Depends(permissions.update())],
)
def generate_carrier_report(
    fire_claim_id: Annotated[UUID, Path(description="The fire claim ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Generate a carrier-friendly fire damage report with neutral titles."""
    UserContext.set(current_user.id)
    fire_claim = crud_util.get_object_or_raise_exception(
        db_session, object_id=fire_claim_id
    )

    fire_claim.carrier_report = _generate_carrier_report(fire_claim)
    fire_claim.carrier_report_at = datetime.now(timezone.utc)
    db_session.add(fire_claim)
    db_session.commit()
    db_session.refresh(fire_claim)

    return fire_claim
