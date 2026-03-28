#!/usr/bin/env python

"""Routes for the Carrier Comparison module"""

import io
import json
import uuid as uuid_mod
from dataclasses import asdict
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.enums import ClaimActivityType
from app.core.log import logger
from app.core.rbac import Modules
from app.models.estimate_project import EstimateProject
from app.models.estimate_room import EstimateRoom
from app.schemas.claim_activity import ClaimActivityCreateDB
from app.schemas.claim_file import ClaimFileCreate
from app.services.carrier_comparison_engine import run_comparison
from app.services.carrier_document_parser import parse_carrier_estimate
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.emails import send_email
from app.utils.exceptions import CrudUtil, exc_bad_request, exc_internal_server
from app.utils.s3 import S3

router = APIRouter()

module = Modules.ESTIMATE_PROJECT
permissions = Permissions(module.value)
crud_util_project = CrudUtil(crud.estimate_project)

CARRIER_ESTIMATE_DIR = "carrier-estimates"


def _get_project_rooms(db_session: Session, project_id: UUID) -> list[EstimateRoom]:
    """Load project with rooms and line items for comparison."""
    from sqlalchemy import select

    with db_session as session:
        stmt = (
            select(EstimateProject)
            .options(
                selectinload(EstimateProject.rooms)
                .selectinload(EstimateRoom.line_items),
            )
            .where(EstimateProject.id == project_id)
        )
        project = session.scalar(stmt)
        return list(project.rooms) if project else []


def _match_room_names(
    items: list[dict], rooms: list[EstimateRoom]
) -> list[dict]:
    """Auto-match parsed room_names to project room IDs."""
    room_map = {}
    for room in rooms:
        room_map[room.name.lower().strip()] = str(room.id)

    for item in items:
        rn = (item.get("room_name") or "").lower().strip()
        if rn in room_map:
            item["matched_room_id"] = room_map[rn]
        else:
            # Try substring match
            for name, rid in room_map.items():
                if rn in name or name in rn:
                    item["matched_room_id"] = rid
                    break
    return items


# ── Upload carrier PDF ──────────────────────────────────────────────

@router.post(
    "/{project_id}/carrier-estimates/upload",
    summary="Upload Carrier Estimate PDF",
    response_description="Parsed carrier estimate with line items",
    response_model=schemas.CarrierEstimateSchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_carrier_estimate(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Carrier estimate PDF.")],
    carrier_name: Annotated[str, Form(description="Carrier name.")],
) -> Any:
    """Upload and parse a carrier estimate PDF."""

    UserContext.set(current_user.id)

    # Validate file type
    allowed = ["application/pdf", "application/vnd.ms-excel",
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "text/csv", "text/plain"]
    if file.content_type not in allowed:
        exc_bad_request(f"Invalid file type '{file.content_type}'.")

    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        exc_bad_request("Empty file.")

    # Upload to S3
    ext = get_file_extension(file.filename) if file.filename else ".pdf"
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{CARRIER_ESTIMATE_DIR}/{project_id}/{unique_name}"

    try:
        # Reset file position for S3 upload
        await file.seek(0)
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.error(f"S3 upload error: {e}")
        exc_internal_server("Failed to upload carrier estimate file.")

    # Get project room names for matching
    rooms = _get_project_rooms(db_session, project_id)
    room_names = [r.name for r in rooms]

    # Parse document
    file_type = "pdf" if "pdf" in (file.content_type or "") else "text"
    parse_result = parse_carrier_estimate(
        file_bytes=file_bytes, file_type=file_type, room_names=room_names
    )

    if not parse_result.items:
        exc_bad_request("Could not extract any line items from the document.")

    # Convert dataclasses to dicts for CRUD layer
    items = [asdict(item) for item in parse_result.items]

    # Match room names
    items = _match_room_names(items, rooms)

    # Create carrier estimate
    return crud.carrier_estimate.create_with_items(
        db_session,
        project_id=project_id,
        carrier_name=carrier_name,
        upload_type=file_type,
        file_name=file.filename,
        file_key=storage_key,
        line_items=items,
        parser_type=parse_result.parser_type,
        parse_confidence=parse_result.parse_confidence,
    )


# ── Paste carrier estimate ──────────────────────────────────────────

@router.post(
    "/{project_id}/carrier-estimates/paste",
    summary="Paste Carrier Estimate Text",
    response_description="Parsed carrier estimate with line items",
    response_model=schemas.CarrierEstimateSchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def paste_carrier_estimate(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.CarrierUploadPasteRequest,
) -> Any:
    """Parse pasted carrier estimate text via Claude."""

    UserContext.set(current_user.id)

    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    if not body.pasted_text or len(body.pasted_text.strip()) < 20:
        exc_bad_request("Pasted text is too short to parse.")

    rooms = _get_project_rooms(db_session, project_id)
    room_names = [r.name for r in rooms]

    parse_result = parse_carrier_estimate(
        pasted_text=body.pasted_text, room_names=room_names
    )

    if not parse_result.items:
        exc_bad_request("Could not extract any line items from the text.")

    items = [asdict(item) for item in parse_result.items]
    items = _match_room_names(items, rooms)

    return crud.carrier_estimate.create_with_items(
        db_session,
        project_id=project_id,
        carrier_name=body.carrier_name,
        upload_type="paste",
        raw_text=body.pasted_text,
        line_items=items,
        parser_type=parse_result.parser_type,
        parse_confidence=parse_result.parse_confidence,
    )


# ── Preview carrier PDF (parse without saving) ─────────────────────

@router.post(
    "/{project_id}/carrier-estimates/preview",
    summary="Preview Carrier Estimate PDF",
    response_description="Parsed line items for user review before saving",
    response_model=schemas.CarrierPreviewResult,
    dependencies=[Depends(permissions.create())],
)
async def preview_carrier_estimate(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Carrier estimate PDF.")],
) -> Any:
    """Parse a carrier estimate PDF and return results for preview — nothing is saved."""

    allowed = ["application/pdf", "application/vnd.ms-excel",
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "text/csv", "text/plain"]
    if file.content_type not in allowed:
        exc_bad_request(f"Invalid file type '{file.content_type}'.")

    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    file_bytes = await file.read()
    if not file_bytes:
        exc_bad_request("Empty file.")

    # Upload to S3 (keep file for later confirm)
    ext = get_file_extension(file.filename) if file.filename else ".pdf"
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{CARRIER_ESTIMATE_DIR}/{project_id}/{unique_name}"

    try:
        await file.seek(0)
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.error(f"S3 upload error: {e}")
        exc_internal_server("Failed to upload carrier estimate file.")

    # Get project room names for matching
    rooms = _get_project_rooms(db_session, project_id)
    room_names = [r.name for r in rooms]

    # Parse document
    file_type = "pdf" if "pdf" in (file.content_type or "") else "text"
    parse_result = parse_carrier_estimate(
        file_bytes=file_bytes, file_type=file_type, room_names=room_names
    )

    if not parse_result.items:
        exc_bad_request("Could not extract any line items from the document.")

    # Convert to preview schema
    preview_items = [
        schemas.CarrierPreviewLineItem(
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            unit_cost=item.unit_cost,
            total_cost=item.total_cost,
            category=item.category,
            line_item_code=item.line_item_code,
            confidence=item.confidence,
            room_name=item.room_name,
        )
        for item in parse_result.items
    ]

    total = sum(i.total_cost or 0 for i in preview_items)

    return schemas.CarrierPreviewResult(
        items=preview_items,
        parser_type=parse_result.parser_type,
        parse_confidence=parse_result.parse_confidence,
        item_count=len(preview_items),
        total_cost=total,
        file_key=storage_key,
    )


# ── Preview pasted text (parse without saving) ────────────────────

@router.post(
    "/{project_id}/carrier-estimates/preview-paste",
    summary="Preview Pasted Carrier Estimate",
    response_description="Parsed line items for user review before saving",
    response_model=schemas.CarrierPreviewResult,
    dependencies=[Depends(permissions.create())],
)
def preview_paste_carrier_estimate(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.CarrierUploadPasteRequest,
) -> Any:
    """Parse pasted carrier estimate text and return results for preview."""

    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    if not body.pasted_text or len(body.pasted_text.strip()) < 20:
        exc_bad_request("Pasted text is too short to parse.")

    rooms = _get_project_rooms(db_session, project_id)
    room_names = [r.name for r in rooms]

    parse_result = parse_carrier_estimate(
        pasted_text=body.pasted_text, room_names=room_names
    )

    if not parse_result.items:
        exc_bad_request("Could not extract any line items from the text.")

    preview_items = [
        schemas.CarrierPreviewLineItem(
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            unit_cost=item.unit_cost,
            total_cost=item.total_cost,
            category=item.category,
            line_item_code=item.line_item_code,
            confidence=item.confidence,
            room_name=item.room_name,
        )
        for item in parse_result.items
    ]

    total = sum(i.total_cost or 0 for i in preview_items)

    return schemas.CarrierPreviewResult(
        items=preview_items,
        parser_type=parse_result.parser_type,
        parse_confidence=parse_result.parse_confidence,
        item_count=len(preview_items),
        total_cost=total,
    )


# ── Confirm previewed estimate (save to DB) ───────────────────────

@router.post(
    "/{project_id}/carrier-estimates/confirm",
    summary="Confirm and Save Previewed Carrier Estimate",
    response_description="Saved carrier estimate with line items",
    response_model=schemas.CarrierEstimateSchema,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def confirm_carrier_estimate(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.CarrierConfirmRequest,
) -> Any:
    """Save user-reviewed line items from a preview as a carrier estimate."""

    UserContext.set(current_user.id)

    crud_util_project.get_object_or_raise_exception(db_session, object_id=project_id)

    if not body.items:
        exc_bad_request("No line items to save.")

    # Convert preview items to dicts for CRUD
    items = [item.dict() for item in body.items]

    # Match room names to project rooms
    rooms = _get_project_rooms(db_session, project_id)
    items = _match_room_names(items, rooms)

    return crud.carrier_estimate.create_with_items(
        db_session,
        project_id=project_id,
        carrier_name=body.carrier_name,
        upload_type=body.upload_type,
        file_name=body.file_name,
        file_key=body.file_key,
        raw_text=body.pasted_text,
        line_items=items,
        parser_type=body.parser_type,
        parse_confidence=body.parse_confidence,
    )


# ── List carrier estimates ──────────────────────────────────────────

@router.get(
    "/{project_id}/carrier-estimates",
    summary="List Carrier Estimates",
    response_description="Carrier estimates for the project",
    response_model=list[schemas.CarrierEstimateSchema],
    dependencies=[Depends(permissions.read())],
)
def list_carrier_estimates(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """List all carrier estimates for a project."""
    return crud.carrier_estimate.get_by_project(db_session, project_id=project_id)


# ── Get single carrier estimate ─────────────────────────────────────

@router.get(
    "/carrier-estimates/{carrier_estimate_id}",
    summary="Get Carrier Estimate",
    response_description="Carrier estimate with line items",
    response_model=schemas.CarrierEstimateSchema,
    dependencies=[Depends(permissions.read())],
)
def get_carrier_estimate(
    carrier_estimate_id: Annotated[UUID, Path(description="The carrier estimate ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get a single carrier estimate with line items."""
    result = crud.carrier_estimate.get_with_items(db_session, obj_id=carrier_estimate_id)
    if not result:
        exc_bad_request("Carrier estimate not found.")
    return result


# ── Delete carrier estimate ─────────────────────────────────────────

@router.delete(
    "/carrier-estimates/{carrier_estimate_id}",
    summary="Delete Carrier Estimate",
    response_description="Deletion confirmation",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def delete_carrier_estimate(
    carrier_estimate_id: Annotated[UUID, Path(description="The carrier estimate ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Delete a carrier estimate and its line items."""
    deleted = crud.carrier_estimate.delete(db_session, obj_id=carrier_estimate_id)
    if not deleted:
        exc_bad_request("Carrier estimate not found.")
    return {"msg": "Carrier estimate deleted successfully."}


# ── Run comparison ──────────────────────────────────────────────────

@router.post(
    "/{project_id}/carrier-comparison/run",
    summary="Run Carrier Comparison",
    response_description="Comparison result",
    response_model=schemas.ComparisonResult,
    dependencies=[Depends(permissions.create())],
)
def run_carrier_comparison(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.ComparisonRunRequest,
) -> Any:
    """Run comparison between ACI estimate and carrier estimate."""

    UserContext.set(current_user.id)

    # Load ACI project rooms with line items
    rooms = _get_project_rooms(db_session, project_id)

    # Load carrier estimate with items
    carrier_est = crud.carrier_estimate.get_with_items(
        db_session, obj_id=body.carrier_estimate_id
    )
    if not carrier_est:
        exc_bad_request("Carrier estimate not found.")

    # Run comparison engine
    result = run_comparison(
        aci_rooms=rooms,
        carrier_items=carrier_est.line_items,
        price_threshold=body.price_threshold,
    )
    result.project_id = project_id
    result.carrier_estimate_id = body.carrier_estimate_id

    # Persist comparison
    comparison_json = json.dumps([room.dict() for room in result.rooms])
    crud.carrier_comparison.upsert(
        db_session,
        project_id=project_id,
        carrier_estimate_id=body.carrier_estimate_id,
        comparison_data=comparison_json,
        aci_total=result.aci_total,
        carrier_total=result.carrier_total,
        supplement_total=result.supplement_total,
        match_count=result.match_count,
        aci_only_count=result.aci_only_count,
        carrier_only_count=result.carrier_only_count,
        price_diff_count=result.price_diff_count,
        price_threshold=body.price_threshold,
    )

    return result


# ── Get saved comparison ────────────────────────────────────────────

@router.get(
    "/{project_id}/carrier-comparison",
    summary="Get Saved Comparison",
    response_description="Most recent comparison result",
    response_model=schemas.ComparisonResult | None,
    dependencies=[Depends(permissions.read())],
)
def get_carrier_comparison(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get the most recent comparison result for a project."""
    comparison = crud.carrier_comparison.get_by_project(
        db_session, project_id=project_id
    )
    if not comparison:
        return None

    # Reconstruct ComparisonResult from persisted data
    rooms = []
    if comparison.comparison_data:
        try:
            rooms_data = json.loads(comparison.comparison_data)
            rooms = [schemas.ComparisonRoom(**r) for r in rooms_data]
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error parsing comparison data: {e}")

    result = schemas.ComparisonResult(
        project_id=comparison.project_id,
        carrier_estimate_id=comparison.carrier_estimate_id,
        rooms=rooms,
        aci_total=comparison.aci_total or 0,
        carrier_total=comparison.carrier_total or 0,
        supplement_total=comparison.supplement_total or 0,
        match_count=comparison.match_count or 0,
        aci_only_count=comparison.aci_only_count or 0,
        carrier_only_count=comparison.carrier_only_count or 0,
        price_diff_count=comparison.price_diff_count or 0,
        price_threshold=comparison.price_threshold or 5.0,
    )

    # Recompute category_breakdown and top_underpaid_items from rooms
    from collections import defaultdict as _defaultdict

    cat_map: dict[str, schemas.CategoryBreakdown] = {}
    candidates: list[schemas.TopUnderpaidItem] = []
    for room in rooms:
        for item in room.items:
            cat = item.category or "Uncategorized"
            if cat not in cat_map:
                cat_map[cat] = schemas.CategoryBreakdown(category=cat)
            cb = cat_map[cat]
            cb.aci_total += item.aci_total or 0
            cb.carrier_total += item.carrier_total or 0
            cb.item_count += 1

            if item.status == "price_diff" and (item.difference or 0) > 0:
                candidates.append(schemas.TopUnderpaidItem(
                    description=item.description or "",
                    room_name=item.room_name,
                    aci_total=item.aci_total or 0,
                    carrier_total=item.carrier_total or 0,
                    difference=item.difference or 0,
                    status="price_diff",
                ))
            elif item.status == "aci_only":
                candidates.append(schemas.TopUnderpaidItem(
                    description=item.description or "",
                    room_name=item.room_name,
                    aci_total=item.aci_total or 0,
                    carrier_total=0,
                    difference=item.aci_total or 0,
                    status="aci_only",
                ))
    for cb in cat_map.values():
        cb.difference = cb.aci_total - cb.carrier_total
    result.category_breakdown = sorted(cat_map.values(), key=lambda c: abs(c.difference), reverse=True)
    candidates.sort(key=lambda c: abs(c.difference), reverse=True)
    result.top_underpaid_items = candidates[:10]

    return result


# ── Send Supplement Email ──────────────────────────────────────────

@router.post(
    "/{project_id}/supplement-email/send",
    summary="Send Supplement Email with PDF Attachment",
    response_description="Confirmation message",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.create())],
)
async def send_supplement_email(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    to: Annotated[str, Form(description="Recipient email address.")],
    subject: Annotated[str, Form(description="Email subject.")],
    body: Annotated[str, Form(description="Email body (plain text).")],
    file: Annotated[UploadFile, File(description="Supplement PDF attachment.")],
) -> Any:
    """Send supplement demand email with PDF attachment, log activity, and store file."""

    UserContext.set(current_user.id)

    # Validate project exists and get claim_id
    project = crud_util_project.get_object_or_raise_exception(
        db_session, object_id=project_id
    )
    if not project.claim_id:
        exc_bad_request("Project is not linked to a claim.")

    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        exc_bad_request("Empty PDF file.")

    # Send email with PDF attachment
    body_html = f"<pre style=\"font-family: Arial, sans-serif; white-space: pre-wrap;\">{body}</pre>"
    try:
        send_email(
            to=to,
            subject=subject,
            body_html=body_html,
            body_plain=body,
            attachments=[(file_bytes, file.filename or "supplement-demand-report.pdf")],
        )
    except Exception as e:
        logger.error(f"Failed to send supplement email: {e}")
        exc_internal_server("Failed to send supplement email.")

    # Log claim activity
    try:
        activity_in = ClaimActivityCreateDB(
            claim_id=project.claim_id,
            user_id=current_user.id,
            timestamp=datetime.now(),
            activity_type=ClaimActivityType.SUPPLEMENT_EMAIL_SENT.value,
            title="Supplement Demand Sent to Carrier",
            details=f"Supplement demand emailed to {to}",
        )
        crud.claim_activity.create(db_session=db_session, obj_in=activity_in)
    except Exception as e:
        logger.error(f"Failed to log supplement email activity: {e}")

    # Store supplement PDF as a claim file
    try:
        file_name = file.filename or "supplement-demand-report.pdf"
        slugged_name = f"{uuid_mod.uuid4()}.pdf"
        object_name = f"{settings.CLAIM_FILE_DIR_PATH}/{project.claim_id}/{slugged_name}"
        file_path = f"{settings.CLAIM_FILE_URL_PATH}/{project.claim_id}/{slugged_name}"

        file_in = ClaimFileCreate(
            claim_id=project.claim_id,
            name=file_name,
            slugged_name=slugged_name,
            type="application/pdf",
            size=len(file_bytes),
            path=file_path,
            description="Supplement Demand Report",
        )
        crud.claim_file.create(db_session, obj_in=file_in)

        S3.upload_file_obj(
            file=io.BytesIO(file_bytes),
            object_name=object_name,
            content_type="application/pdf",
        )
    except Exception as e:
        logger.error(f"Failed to store supplement PDF as claim file: {e}")

    return {"msg": "Supplement email sent successfully."}


# ── AI Policy Argument Generation ────────────────────────────────

VALID_ARGUMENT_TYPES = {
    "loss_settlement": "Loss Settlement — cite the policy's loss settlement provisions to argue the carrier must settle at full replacement cost.",
    "ordinance_or_law": "Ordinance or Law — reference Ordinance or Law coverage requiring payment for code-required upgrades.",
    "replacement_cost": "Replacement Cost / RCV — cite replacement cost valuation language requiring like-kind-and-quality repair without depreciation.",
    "duties_after_loss": "Duties After Loss — demonstrate the insured has met their obligations and request the carrier fulfill theirs.",
    "additional_coverages": "Additional Coverages — identify additional coverage provisions (ALE, debris removal, etc.) that apply to the loss.",
    "general_coverage": "General Coverage Support — provide a comprehensive overview of applicable coverages and policy limits.",
}


def _ai_is_configured() -> bool:
    """Check if Anthropic Claude API key is configured."""
    key = getattr(settings, "ANTHROPIC_API_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _get_claude_client() -> anthropic.Anthropic:
    """Return a configured Anthropic client."""
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


@router.post(
    "/{project_id}/policy-argument/generate",
    summary="Generate AI Policy Support Argument",
    response_description="AI-generated policy argument text",
    response_model=schemas.PolicyArgumentResponse,
    dependencies=[Depends(permissions.create())],
)
def generate_policy_argument(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.PolicyArgumentRequest,
) -> Any:
    """Generate an AI-powered policy support argument using Claude."""

    # Validate argument type
    if body.argument_type not in VALID_ARGUMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid argument_type '{body.argument_type}'. Valid: {list(VALID_ARGUMENT_TYPES.keys())}",
        )

    # Check AI configuration
    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Load estimate project (with fire_claim eagerly loaded)
    project = crud.estimate_project.get_with_details(
        db_session, obj_id=project_id
    )
    if not project:
        raise HTTPException(status_code=404, detail="Estimate project not found.")

    # Determine fire_claim_id from the project's fire_claim relationship
    fire_claim = project.fire_claim
    fire_claim_id = fire_claim.id if fire_claim else None

    # Load policy document linked to the fire claim
    policy_docs = []
    if fire_claim_id:
        policy_docs = crud.policy_document.get_by_entity(
            db_session, fire_claim_id=fire_claim_id
        )
    if not policy_docs:
        raise HTTPException(
            status_code=404,
            detail="No policy document linked to this project's fire claim.",
        )
    doc = policy_docs[0]

    # Load policy clauses
    clauses = crud.policy_clause.get_by_document(
        db_session, document_id=doc.id
    )

    # Load policy intelligence
    intel = crud.policy_intelligence.get_by_document(
        db_session, document_id=doc.id
    )

    # Load comparison result (if available)
    comparison = crud.carrier_comparison.get_by_project(
        db_session, project_id=project_id
    )
    comparison_rooms = []
    if comparison and comparison.comparison_data:
        try:
            comparison_rooms = json.loads(comparison.comparison_data)
        except (json.JSONDecodeError, Exception):
            pass

    # ── Build context for Claude ──────────────────────────────────

    context_parts = []

    # Policy metadata
    carrier = getattr(intel, "carrier", None) or doc.carrier or (
        fire_claim.carrier_name if fire_claim else "Unknown"
    )
    insured = getattr(intel, "insured_name", None) or doc.insured_name or (
        fire_claim.insured_name if fire_claim else ""
    )
    claim_num = doc.claim_number or (
        fire_claim.claim_number if fire_claim else ""
    )
    policy_num = getattr(intel, "policy_number", None) or doc.policy_number or (
        fire_claim.policy_number if fire_claim else ""
    )

    context_parts.append(
        f"CARRIER: {carrier}\n"
        f"INSURED: {insured}\n"
        f"CLAIM NUMBER: {claim_num}\n"
        f"POLICY NUMBER: {policy_num}"
    )

    # Property address
    if fire_claim:
        addr_parts = [
            fire_claim.address_line1,
            fire_claim.city,
            fire_claim.state,
            fire_claim.zip,
        ]
        addr = ", ".join(p for p in addr_parts if p)
        if addr:
            context_parts.append(f"PROPERTY ADDRESS: {addr}")

    # Coverage limits from policy intelligence
    if intel:
        coverage_lines = []
        for attr, label in [
            ("coverage_a_dwelling", "Coverage A (Dwelling)"),
            ("coverage_b_other_structures", "Coverage B (Other Structures)"),
            ("coverage_c_personal_property", "Coverage C (Personal Property)"),
            ("coverage_d_loss_of_use", "Coverage D (Loss of Use)"),
            ("deductible_amount", "Deductible"),
        ]:
            val = getattr(intel, attr, None)
            if val:
                coverage_lines.append(f"  {label}: ${val:,.2f}")
        if coverage_lines:
            context_parts.append("COVERAGE LIMITS:\n" + "\n".join(coverage_lines))

    # Extracted policy clauses
    if clauses:
        clause_lines = []
        for c in clauses:
            line = f"[{c.clause_type}] {c.title}"
            if c.amount:
                line += f" — ${c.amount:,.2f}"
            if c.raw_text:
                line += f'\n  Quote: "{c.raw_text[:600]}"'
            if c.summary:
                line += f"\n  Summary: {c.summary}"
            clause_lines.append(line)
        context_parts.append("EXTRACTED POLICY CLAUSES:\n" + "\n".join(clause_lines))

    # Comparison data
    if comparison:
        context_parts.append(
            f"COMPARISON TOTALS:\n"
            f"  ACI (Our) Estimate: ${comparison.aci_total or 0:,.2f}\n"
            f"  Carrier Estimate: ${comparison.carrier_total or 0:,.2f}\n"
            f"  Supplement Amount: ${comparison.supplement_total or 0:,.2f}\n"
            f"  Items Omitted by Carrier: {comparison.aci_only_count or 0}\n"
            f"  Items with Price Differences: {comparison.price_diff_count or 0}"
        )

    # Item breakdown (first 40 non-match items for context)
    if comparison_rooms:
        diff_lines = []
        for room in comparison_rooms:
            room_name = room.get("room_name", "Unknown")
            for item in room.get("items", []):
                if item.get("status") != "match":
                    desc = item.get("description", "")
                    aci = item.get("aci_total") or 0
                    carr = item.get("carrier_total") or 0
                    st = item.get("status", "")
                    diff_lines.append(
                        f"  [{room_name}] {desc} — ACI: ${aci:,.2f} | Carrier: ${carr:,.2f} ({st})"
                    )
                if len(diff_lines) >= 40:
                    break
            if len(diff_lines) >= 40:
                break
        if diff_lines:
            context_parts.append(
                "DISPUTED / OMITTED ITEMS:\n" + "\n".join(diff_lines)
            )

    # ── System prompt ─────────────────────────────────────────────

    type_description = VALID_ARGUMENT_TYPES[body.argument_type]

    system_prompt = (
        "You are a professional insurance adjuster writing a policy support argument "
        "for a supplement demand. Write a formal, persuasive argument that:\n\n"
        "1. References specific policy language (quote extracted clauses verbatim when available)\n"
        "2. Cites coverage amounts and limits where relevant\n"
        "3. References the comparison findings (omitted and underpaid items) with dollar amounts\n"
        "4. Maintains a firm but professional tone appropriate for carrier correspondence\n"
        "5. Structures as: heading, RE line with claim details, body with clause quotes, "
        "supplement dollar amounts, closing request\n\n"
        f"Argument type: {type_description}\n\n"
        "Write only the argument text. Do not include any meta-commentary or instructions."
    )

    # ── Call Claude ────────────────────────────────────────────────

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": "\n\n".join(context_parts)},
            ],
        )
        argument_text = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during policy argument generation: {e}")
        raise HTTPException(
            status_code=503,
            detail="AI policy argument generation failed. Please try again.",
        )

    return schemas.PolicyArgumentResponse(
        argument_type=body.argument_type,
        argument_text=argument_text,
    )


# ── AI Supplement Argument Generation ────────────────────────────


@router.post(
    "/{project_id}/supplement-argument/generate",
    summary="Generate AI Supplement Argument",
    response_description="AI-generated supplement argument combining comparison data and policy support",
    response_model=schemas.SupplementArgumentResponse,
    dependencies=[Depends(permissions.create())],
)
def generate_supplement_argument(
    project_id: Annotated[UUID, Path(description="The estimate project ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    body: schemas.SupplementArgumentRequest,
) -> Any:
    """Generate an AI-powered supplement argument from comparison data + optional policy support."""

    # Check AI configuration
    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Load estimate project (with fire_claim eagerly loaded)
    project = crud.estimate_project.get_with_details(
        db_session, obj_id=project_id
    )
    if not project:
        raise HTTPException(status_code=404, detail="Estimate project not found.")

    fire_claim = project.fire_claim
    fire_claim_id = fire_claim.id if fire_claim else None

    # Load comparison result — REQUIRED for supplement argument
    comparison = crud.carrier_comparison.get_by_project(
        db_session, project_id=project_id
    )
    if not comparison:
        raise HTTPException(
            status_code=400,
            detail="No carrier comparison found. Run a carrier comparison first.",
        )

    comparison_rooms = []
    if comparison.comparison_data:
        try:
            comparison_rooms = json.loads(comparison.comparison_data)
        except (json.JSONDecodeError, Exception):
            pass

    # Optionally load policy docs/clauses/intelligence (enhances argument if available)
    has_policy_support = False
    policy_docs = []
    doc = None
    clauses = []
    intel = None

    if fire_claim_id:
        policy_docs = crud.policy_document.get_by_entity(
            db_session, fire_claim_id=fire_claim_id
        )
    if policy_docs:
        has_policy_support = True
        doc = policy_docs[0]
        clauses = crud.policy_clause.get_by_document(
            db_session, document_id=doc.id
        )
        intel = crud.policy_intelligence.get_by_document(
            db_session, document_id=doc.id
        )

    # ── Build context for Claude ──────────────────────────────────

    context_parts = []

    # Claim metadata
    carrier = (
        (getattr(intel, "carrier", None) if intel else None)
        or (doc.carrier if doc else None)
        or (fire_claim.carrier_name if fire_claim else "Unknown")
    )
    insured = (
        (getattr(intel, "insured_name", None) if intel else None)
        or (doc.insured_name if doc else None)
        or (fire_claim.insured_name if fire_claim else "")
    )
    claim_num = (
        (doc.claim_number if doc else None)
        or (fire_claim.claim_number if fire_claim else "")
    )
    policy_num = (
        (getattr(intel, "policy_number", None) if intel else None)
        or (doc.policy_number if doc else None)
        or (fire_claim.policy_number if fire_claim else "")
    )

    context_parts.append(
        f"CARRIER: {carrier}\n"
        f"INSURED: {insured}\n"
        f"CLAIM NUMBER: {claim_num}\n"
        f"POLICY NUMBER: {policy_num}"
    )

    # Property address
    if fire_claim:
        addr_parts = [
            fire_claim.address_line1,
            fire_claim.city,
            fire_claim.state,
            fire_claim.zip,
        ]
        addr = ", ".join(p for p in addr_parts if p)
        if addr:
            context_parts.append(f"PROPERTY ADDRESS: {addr}")

    # Comparison totals
    context_parts.append(
        f"COMPARISON TOTALS:\n"
        f"  ACI (Our) Estimate: ${comparison.aci_total or 0:,.2f}\n"
        f"  Carrier Estimate: ${comparison.carrier_total or 0:,.2f}\n"
        f"  Supplement Amount: ${comparison.supplement_total or 0:,.2f}\n"
        f"  Items Omitted by Carrier: {comparison.aci_only_count or 0}\n"
        f"  Items with Price Differences: {comparison.price_diff_count or 0}"
    )

    # Item breakdown (up to 60 non-match items for comprehensive context)
    if comparison_rooms:
        diff_lines = []
        for room in comparison_rooms:
            room_name = room.get("room_name", "Unknown")
            for item in room.get("items", []):
                if item.get("status") != "match":
                    desc = item.get("description", "")
                    aci = item.get("aci_total") or 0
                    carr = item.get("carrier_total") or 0
                    st = item.get("status", "")
                    diff_lines.append(
                        f"  [{room_name}] {desc} — ACI: ${aci:,.2f} | Carrier: ${carr:,.2f} ({st})"
                    )
                if len(diff_lines) >= 60:
                    break
            if len(diff_lines) >= 60:
                break
        if diff_lines:
            context_parts.append(
                "DISPUTED / OMITTED ITEMS:\n" + "\n".join(diff_lines)
            )

    # Coverage limits from policy intelligence (optional)
    if intel:
        coverage_lines = []
        for attr, label in [
            ("coverage_a_dwelling", "Coverage A (Dwelling)"),
            ("coverage_b_other_structures", "Coverage B (Other Structures)"),
            ("coverage_c_personal_property", "Coverage C (Personal Property)"),
            ("coverage_d_loss_of_use", "Coverage D (Loss of Use)"),
            ("deductible_amount", "Deductible"),
        ]:
            val = getattr(intel, attr, None)
            if val:
                coverage_lines.append(f"  {label}: ${val:,.2f}")
        if coverage_lines:
            context_parts.append("COVERAGE LIMITS:\n" + "\n".join(coverage_lines))

    # Extracted policy clauses (optional)
    if clauses:
        clause_lines = []
        for c in clauses:
            line = f"[{c.clause_type}] {c.title}"
            if c.amount:
                line += f" — ${c.amount:,.2f}"
            if c.raw_text:
                line += f'\n  Quote: "{c.raw_text[:600]}"'
            if c.summary:
                line += f"\n  Summary: {c.summary}"
            clause_lines.append(line)
        context_parts.append("EXTRACTED POLICY CLAUSES:\n" + "\n".join(clause_lines))

    # ── System prompt ─────────────────────────────────────────────

    policy_instruction = ""
    if has_policy_support:
        policy_instruction = (
            "\n6. POLICY SUPPORT: Quote specific policy clauses verbatim to reinforce each demand point. "
            "Reference coverage limits and applicable provisions.\n"
        )

    system_prompt = (
        "You are a professional insurance adjuster writing a comprehensive supplement demand argument. "
        "This argument combines the carrier comparison findings (omitted and underpaid items) "
        "with policy language support (if available) into a single persuasive demand.\n\n"
        "Structure the argument with these sections:\n"
        "1. OVERVIEW: Brief summary of the claim, parties, and the basis for the supplement demand.\n"
        "2. SCOPE DIFFERENCES: Items the carrier omitted entirely, grouped by room with dollar amounts.\n"
        "3. PRICING DIFFERENCES: Items the carrier underpaid, with carrier vs. ACI amounts and the difference.\n"
        "4. OMITTED ITEMS SUMMARY: Total count and dollar amount of all omitted items.\n"
        "5. DEMANDED ACTION: Clear statement of the total additional amount owed and request for revised payment.\n"
        f"{policy_instruction}\n"
        "IMPORTANT FORMATTING RULES:\n"
        "- Write in plain text only. Do NOT use any markdown formatting such as **, ##, ###, *, or bullet symbols.\n"
        "- Use line breaks and indentation for structure instead of markdown.\n"
        "- Use ALL CAPS for section headings.\n"
        "- Maintain a firm but professional tone appropriate for carrier correspondence.\n"
        "- Include specific dollar amounts throughout.\n"
        "- Write only the argument text. Do not include any meta-commentary or instructions."
    )

    # ── Call Claude ────────────────────────────────────────────────

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=6000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": "\n\n".join(context_parts)},
            ],
        )
        argument_text = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during supplement argument generation: {e}")
        raise HTTPException(
            status_code=503,
            detail="AI supplement argument generation failed. Please try again.",
        )

    return schemas.SupplementArgumentResponse(
        argument_text=argument_text,
        has_policy_support=has_policy_support,
    )
