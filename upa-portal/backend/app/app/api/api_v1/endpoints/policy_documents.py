#!/usr/bin/env python

"""Routes for the Policy Document Vault module"""

import io
import json
import logging
import re
import uuid as uuid_mod
from datetime import date
from pathlib import Path as FsPath
from typing import Annotated, Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
import anthropic
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.models.policy_clause import PolicyClause
from app.models.policy_document import PolicyDocument
from app.models.policy_intelligence import PolicyIntelligence
from app.schemas.policy_intelligence import PolicyIntelligenceUpdate
from app.schemas.policy_clause import (
    AssistantActionRequest,
    AssistantActionResponse,
    PolicyClauseCreate,
    PolicyClauseInDB,
)
from app.schemas.policy_document import (
    ImportFromClaimFileRequest,
    PolicyDocumentAttach,
    PolicyDocumentInDB,
    PolicyDocumentList,
    PolicyDocumentUpdate,
)
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

logger = logging.getLogger(__name__)

router = APIRouter()

module = Modules.POLICY_DOCUMENT
permissions = Permissions(module.value)
crud_util = CrudUtil(crud.policy_document)

POLICY_VAULT_DIR = "policy-vault"


def _get_local_media_dir() -> FsPath:
    """Resolve local media directory — Docker (/app/media/) or local fallback."""
    docker_path = FsPath("/app/media") / POLICY_VAULT_DIR
    if docker_path.parent.exists():
        docker_path.mkdir(parents=True, exist_ok=True)
        return docker_path
    local_path = FsPath("media") / POLICY_VAULT_DIR
    local_path.mkdir(parents=True, exist_ok=True)
    return local_path


def _save_local(contents: bytes, filename: str) -> FsPath:
    """Save file to local media directory. Returns the file path."""
    media_dir = _get_local_media_dir()
    filepath = media_dir / filename
    filepath.write_bytes(contents)
    return filepath


def _read_local(storage_key: str) -> bytes | None:
    """Read a file from local media storage. Returns bytes or None."""
    filename = storage_key.split("/")[-1] if "/" in storage_key else storage_key
    for base in [FsPath("/app/media"), FsPath("media")]:
        filepath = base / POLICY_VAULT_DIR / filename
        if filepath.is_file():
            return filepath.read_bytes()
    return None


def _ai_is_configured() -> bool:
    """Check if Anthropic Claude API key is configured."""
    key = getattr(settings, "ANTHROPIC_API_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _get_claude_client() -> anthropic.Anthropic:
    """Return a configured Anthropic client."""
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── LIST / SEARCH ───────────────────────────────────────────────────────


@router.get(
    "",
    summary="List Policy Documents",
    response_model=CustomPage[PolicyDocumentList],
    dependencies=[Depends(permissions.read())],
)
def list_policy_documents(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    carrier: str | None = Query(None),
    policy_number: str | None = Query(None),
    insured_name: str | None = Query(None),
    policy_type: str | None = Query(None),
    property_state: str | None = Query(None),
    claim_id: UUID | None = Query(None),
    client_id: UUID | None = Query(None),
    lead_id: UUID | None = Query(None),
    fire_claim_id: UUID | None = Query(None),
    adjuster_case_id: UUID | None = Query(None),
    effective_after: date | None = Query(None),
    effective_before: date | None = Query(None),
) -> Any:
    """Paginated list with search/filter query params."""
    return crud.policy_document.search(
        db_session,
        carrier=carrier,
        policy_number=policy_number,
        insured_name=insured_name,
        policy_type=policy_type,
        property_state=property_state,
        claim_id=claim_id,
        client_id=client_id,
        lead_id=lead_id,
        fire_claim_id=fire_claim_id,
        adjuster_case_id=adjuster_case_id,
        effective_after=effective_after,
        effective_before=effective_before,
    )


# ── UPLOAD ──────────────────────────────────────────────────────────────


@router.post(
    "",
    summary="Upload Policy Document",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_policy_document(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Policy PDF file.")],
    insured_name: str | None = Form(None),
    carrier: str | None = Form(None),
    policy_number: str | None = Form(None),
    claim_number: str | None = Form(None),
    policy_type: str | None = Form(None),
    effective_date: date | None = Form(None),
    expiration_date: date | None = Form(None),
    property_address: str | None = Form(None),
    property_city: str | None = Form(None),
    property_state: str | None = Form(None),
    property_zip: str | None = Form(None),
    notes: str | None = Form(None),
    claim_id: UUID | None = Form(None),
    client_id: UUID | None = Form(None),
    lead_id: UUID | None = Form(None),
    fire_claim_id: UUID | None = Form(None),
    adjuster_case_id: UUID | None = Form(None),
) -> Any:
    """Upload a policy PDF with optional metadata."""
    UserContext.set(current_user.id)

    ext = get_file_extension(file.filename) if file.filename else ".pdf"
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{POLICY_VAULT_DIR}/{unique_name}"

    # Read file size
    contents = await file.read()
    file_size = len(contents)
    await file.seek(0)

    try:
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.warning(f"S3 upload failed, falling back to local storage: {e}")
        _save_local(contents, unique_name)

    doc = PolicyDocument(
        file_name=file.filename or unique_name,
        file_key=storage_key,
        file_size=file_size,
        content_type=file.content_type or "application/pdf",
        insured_name=insured_name,
        carrier=carrier,
        policy_number=policy_number,
        claim_number=claim_number,
        policy_type=policy_type,
        effective_date=effective_date,
        expiration_date=expiration_date,
        property_address=property_address,
        property_city=property_city,
        property_state=property_state,
        property_zip=property_zip,
        notes=notes,
        claim_id=claim_id,
        client_id=client_id,
        lead_id=lead_id,
        fire_claim_id=fire_claim_id,
        adjuster_case_id=adjuster_case_id,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


# ── ATTACH TO ENTITY ────────────────────────────────────────────────────


@router.post(
    "/attach",
    summary="Attach Policy to Entity",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.update())],
)
def attach_to_entity(
    body: PolicyDocumentAttach,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Link an existing vault document to an entity."""
    UserContext.set(current_user.id)
    doc = crud.policy_document.get(db_session, obj_id=body.policy_document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    if body.claim_id:
        doc.claim_id = body.claim_id
    if body.client_id:
        doc.client_id = body.client_id
    if body.lead_id:
        doc.lead_id = body.lead_id
    if body.fire_claim_id:
        doc.fire_claim_id = body.fire_claim_id
    if body.adjuster_case_id:
        doc.adjuster_case_id = body.adjuster_case_id

    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


# ── IMPORT FROM CLAIM FILE ────────────────────────────────────────────


@router.post(
    "/from-claim-file",
    summary="Import a Claim File as a Policy Document",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.create())],
)
def import_from_claim_file(
    body: ImportFromClaimFileRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Copy a PDF claim file into the policy vault and create a PolicyDocument."""
    UserContext.set(current_user.id)

    # 1. Fetch claim file
    claim_file = crud.claim_file.get(db_session, obj_id=body.claim_file_id)
    if not claim_file:
        raise HTTPException(status_code=404, detail="Claim file not found.")

    # 2. Validate PDF
    if claim_file.type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files can be imported as policy documents.",
        )

    # 3. S3 copy from claim-file bucket path to policy-vault
    source_key = (
        f"{settings.CLAIM_FILE_DIR_PATH}/{claim_file.claim_id}/{claim_file.slugged_name}"
    )
    dest_key = f"{POLICY_VAULT_DIR}/{uuid_mod.uuid4()}.pdf"

    try:
        S3.copy_file_obj(source_key, dest_key)
    except Exception as e:
        logger.error("S3 copy failed for claim file import: %s", e)
        raise HTTPException(
            status_code=500, detail="Failed to copy file to policy vault."
        )

    # 4. Create PolicyDocument record
    from app.schemas.policy_document import PolicyDocumentCreate

    doc_in = PolicyDocumentCreate(
        file_name=claim_file.name,
        file_key=dest_key,
        file_size=claim_file.size,
        content_type="application/pdf",
    )
    doc = crud.policy_document.create(db_session, obj_in=doc_in)
    doc.fire_claim_id = body.fire_claim_id
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


# ── GET BY ENTITY ───────────────────────────────────────────────────────


@router.get(
    "/by-entity",
    summary="Get Policies by Entity",
    response_model=list[PolicyDocumentList],
    dependencies=[Depends(permissions.read())],
)
def get_by_entity(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    claim_id: UUID | None = Query(None),
    client_id: UUID | None = Query(None),
    lead_id: UUID | None = Query(None),
    fire_claim_id: UUID | None = Query(None),
    adjuster_case_id: UUID | None = Query(None),
) -> Any:
    """Get policy documents linked to a specific entity."""
    return crud.policy_document.get_by_entity(
        db_session,
        claim_id=claim_id,
        client_id=client_id,
        lead_id=lead_id,
        fire_claim_id=fire_claim_id,
        adjuster_case_id=adjuster_case_id,
    )


# ── GET CLAUSES ────────────────────────────────────────────────────────


@router.get(
    "/{doc_id}/clauses",
    summary="Get Policy Clauses",
    response_model=list[PolicyClauseInDB],
    dependencies=[Depends(permissions.read())],
)
def get_clauses(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    type: str | None = Query(None, description="Filter by clause_type"),
) -> Any:
    """Get extracted clauses for a policy document, optionally filtered by type."""
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")
    return crud.policy_clause.get_by_document(
        db_session, document_id=doc_id, clause_type=type
    )


# ── INTELLIGENCE BUILDER ─────────────────────────────────────────────


# Coverage mapping: pattern keywords → coverage field
_COVERAGE_MAP = {
    "dwelling": "coverage_a_dwelling",
    "coverage a": "coverage_a_dwelling",
    "other structures": "coverage_b_other_structures",
    "coverage b": "coverage_b_other_structures",
    "personal property": "coverage_c_personal_property",
    "coverage c": "coverage_c_personal_property",
    "loss of use": "coverage_d_loss_of_use",
    "coverage d": "coverage_d_loss_of_use",
    "additional living": "coverage_d_loss_of_use",
    "ale": "coverage_d_loss_of_use",
    "personal liability": "coverage_e_liability",
    "coverage e": "coverage_e_liability",
    "liability": "coverage_e_liability",
    "medical payments": "coverage_f_medical",
    "coverage f": "coverage_f_medical",
    "medical": "coverage_f_medical",
}


def _match_coverage_field(title: str, applies_to: str | None) -> str | None:
    """Match a clause title/applies_to to a standard coverage field name."""
    search = f"{title} {applies_to or ''}".lower()
    for pattern, field in _COVERAGE_MAP.items():
        if pattern in search:
            return field
    return None


def _build_intelligence_from_clauses(
    db_session: Session,
    doc: PolicyDocument,
    clauses: list[PolicyClause],
) -> PolicyIntelligence:
    """Build or update the PolicyIntelligence record from extracted clauses."""
    data: dict = {
        "carrier": doc.carrier,
        "insured_name": doc.insured_name,
        "policy_number": doc.policy_number,
    }

    other_coverages: list[dict] = []
    endorsements: list[dict] = []
    exclusions: list[dict] = []
    deductible_parts: list[str] = []
    confidence_values: list[float] = []

    for c in clauses:
        confidence_values.append(c.ai_confidence)

        if c.clause_type in ("coverage", "limit"):
            field = _match_coverage_field(c.title, c.applies_to)
            if field and c.amount:
                amt = float(c.amount)
                existing = data.get(field)
                # Only set if not yet set, or if this is a main coverage
                # (higher amount) rather than a sub-limit
                if existing is None or amt > existing:
                    data[field] = amt
                else:
                    other_coverages.append({
                        "title": c.title,
                        "amount": amt,
                        "summary": c.summary,
                    })
            elif c.amount:
                other_coverages.append({
                    "title": c.title,
                    "amount": float(c.amount),
                    "summary": c.summary,
                })

        elif c.clause_type == "deductible":
            if c.amount:
                title_lower = c.title.lower()
                if "wind" in title_lower or "hail" in title_lower:
                    data["deductible_wind_hail"] = float(c.amount)
                elif "hurricane" in title_lower:
                    data["deductible_hurricane"] = float(c.amount)
                elif not data.get("deductible_amount"):
                    data["deductible_amount"] = float(c.amount)
            if c.percentage:
                data["deductible_percentage"] = c.percentage
            if c.summary or c.raw_text:
                deductible_parts.append(
                    f"{c.title}: {c.summary or c.raw_text}"
                )

        elif c.clause_type == "endorsement":
            endorsements.append({
                "title": c.title,
                "summary": c.summary or "",
            })

        elif c.clause_type == "exclusion":
            exclusions.append({
                "title": c.title,
                "summary": c.summary or "",
            })

        elif c.clause_type == "replacement_cost_acv":
            text = c.summary or c.raw_text or ""
            existing = data.get("replacement_cost_language", "")
            data["replacement_cost_language"] = (
                f"{existing}\n{text}".strip() if existing else text
            )

        elif c.clause_type == "ordinance_law":
            data["ordinance_and_law"] = c.summary or c.raw_text or ""

        elif c.clause_type == "matching":
            data["matching_language"] = c.summary or c.raw_text or ""

        elif c.clause_type == "loss_settlement":
            data["loss_settlement_clause"] = c.summary or c.raw_text or ""

        elif c.clause_type == "appraisal":
            data["appraisal_clause"] = c.summary or c.raw_text or ""

        elif c.clause_type == "duties_after_loss":
            data["duties_after_loss"] = c.summary or c.raw_text or ""

        elif c.clause_type == "ale_loss_of_use":
            data["ale_loss_of_use_details"] = c.summary or c.raw_text or ""
            if c.amount:
                data["coverage_d_loss_of_use"] = float(c.amount)

        elif c.clause_type == "deadline_notice":
            data["deadline_notice_details"] = c.summary or c.raw_text or ""

    # Serialize JSON fields
    if other_coverages:
        data["other_coverage_json"] = json.dumps(other_coverages)
    if endorsements:
        data["endorsements_json"] = json.dumps(endorsements)
    if exclusions:
        data["exclusions_json"] = json.dumps(exclusions)
    if deductible_parts:
        data["deductible_details"] = "\n".join(deductible_parts)

    # Confidence score
    if confidence_values:
        data["confidence_score"] = sum(confidence_values) / len(confidence_values)

    update_obj = PolicyIntelligenceUpdate(**data)
    intel = crud.policy_intelligence.upsert(
        db_session, document_id=doc.id, obj_in=update_obj
    )
    return intel


# ── EXTRACT CLAUSES ───────────────────────────────────────────────────

VALID_CLAUSE_TYPES = {
    "coverage", "deductible", "limit", "endorsement", "exclusion",
    "loss_settlement", "replacement_cost_acv", "duties_after_loss",
    "appraisal", "matching", "ordinance_law", "ale_loss_of_use",
    "deadline_notice",
}


@router.post(
    "/{doc_id}/extract-clauses",
    summary="AI: Extract Policy Clauses",
    response_model=list[PolicyClauseInDB],
    dependencies=[Depends(permissions.update())],
)
def extract_clauses(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Full structured AI extraction of coverages, clauses, endorsements, exclusions."""
    UserContext.set(current_user.id)
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    # Step 1: Get extracted text
    extracted_text = doc.ai_extracted_text
    if not extracted_text:
        try:
            import pdfplumber

            file_bytes = None
            try:
                downloaded = S3.download_files_from_s3([doc.file_key])
                if downloaded:
                    file_bytes, _ = downloaded[0]
            except Exception:
                pass
            if not file_bytes:
                file_bytes = _read_local(doc.file_key)
            if not file_bytes:
                raise HTTPException(
                    status_code=400, detail="Could not download PDF from storage."
                )
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                extracted_text = "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
            doc.ai_extracted_text = extracted_text
            db_session.add(doc)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"pdfplumber extraction failed for {doc.file_name}: {e}")
            raise HTTPException(
                status_code=400, detail="Could not extract text from PDF."
            )

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(status_code=400, detail="PDF contains no extractable text.")

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Step 2: Delete existing clauses (re-extraction)
    crud.policy_clause.delete_by_document(db_session, document_id=doc_id)

    # Step 3: AI extraction via Claude
    system_prompt = (
        "You are an expert insurance policy analyst. Extract ALL clauses, coverages, "
        "endorsements, exclusions, deductibles, limits, and special provisions from the "
        "provided policy document text.\n\n"
        "Return a JSON array of objects, each with these fields:\n"
        '- "clause_type": one of: coverage, deductible, limit, endorsement, exclusion, '
        "loss_settlement, replacement_cost_acv, duties_after_loss, appraisal, matching, "
        "ordinance_law, ale_loss_of_use, deadline_notice\n"
        '- "title": short descriptive title (e.g. "Dwelling Coverage A")\n'
        '- "summary": plain English explanation of what this clause means\n'
        '- "raw_text": exact text quoted from the policy\n'
        '- "amount": dollar amount if applicable (number, no $ sign) or null\n'
        '- "percentage": percentage if applicable (number) or null\n'
        '- "section_reference": e.g. "Section I, Coverage A" or null\n'
        '- "applies_to": what the clause covers (e.g. "dwelling", "personal property") or null\n'
        '- "ai_confidence": your confidence 0.0 to 1.0\n'
        '- "sort_order": suggested display order (integer starting at 0)\n\n'
        "Be thorough — extract every clause type you can find. "
        "Return ONLY the JSON array, no other text."
    )

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=8192,
            system=system_prompt,
            messages=[
                {"role": "user", "content": extracted_text[:100000]},
            ],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during clause extraction: {e}")
        raise HTTPException(status_code=503, detail="AI clause extraction failed.")

    # Step 4: Parse and create records
    try:
        json_match = re.search(r"\[.*\]", raw, re.DOTALL)
        clause_list = json.loads(json_match.group()) if json_match else []
    except Exception:
        clause_list = []

    created_clauses = []
    for idx, item in enumerate(clause_list):
        clause_type = item.get("clause_type", "coverage")
        if clause_type not in VALID_CLAUSE_TYPES:
            clause_type = "coverage"
        clause = PolicyClause(
            policy_document_id=doc_id,
            clause_type=clause_type,
            title=(item.get("title") or "Untitled")[:256],
            summary=item.get("summary"),
            raw_text=item.get("raw_text"),
            amount=item.get("amount"),
            percentage=item.get("percentage"),
            section_reference=(item.get("section_reference") or "")[:128] or None,
            applies_to=(item.get("applies_to") or "")[:256] or None,
            ai_confidence=float(item.get("ai_confidence", 0.5)),
            sort_order=item.get("sort_order", idx),
        )
        db_session.add(clause)
        created_clauses.append(clause)

    doc.extraction_status = "clauses_extracted"
    db_session.add(doc)
    db_session.commit()
    for c in created_clauses:
        db_session.refresh(c)

    # Build consolidated intelligence record from extracted clauses
    try:
        _build_intelligence_from_clauses(db_session, doc, created_clauses)
        db_session.commit()
    except Exception as e:
        logger.warning(f"Intelligence build failed (non-fatal): {e}")
        db_session.rollback()

    return created_clauses


# ── SUMMARIZE ─────────────────────────────────────────────────────────


@router.post(
    "/{doc_id}/summarize",
    summary="AI: Generate Policy Summary",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.update())],
)
def summarize_policy(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Generate AI summary + claim guidance notes and set assistant_ready=True."""
    UserContext.set(current_user.id)
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Build context from extracted text + clauses
    extracted_text = doc.ai_extracted_text or ""
    clauses = crud.policy_clause.get_by_document(db_session, document_id=doc_id)

    clause_summary = ""
    if clauses:
        clause_lines = []
        for c in clauses:
            line = f"- [{c.clause_type}] {c.title}"
            if c.amount:
                line += f" (${c.amount:,.2f})"
            if c.summary:
                line += f": {c.summary}"
            clause_lines.append(line)
        clause_summary = "\n".join(clause_lines)

    system_prompt = (
        "You are an expert insurance adjuster assistant. Based on the policy text and "
        "extracted clauses below, produce TWO outputs:\n\n"
        "1. **ai_summary**: A comprehensive plain-English summary of this policy — who is "
        "insured, what is covered, key limits, deductibles, notable endorsements and exclusions. "
        "Write 3-5 paragraphs suitable for an adjuster who needs to understand this policy quickly.\n\n"
        "2. **claim_guidance_notes**: Practical claim handling guidance based on this policy — "
        "key deadlines, duties after loss, appraisal process, special conditions, things the "
        "adjuster should watch out for when processing a claim under this policy.\n\n"
        'Return a JSON object with keys "ai_summary" and "claim_guidance_notes".'
    )

    context_text = f"POLICY TEXT:\n{extracted_text[:25000]}"
    if clause_summary:
        context_text += f"\n\nEXTRACTED CLAUSES:\n{clause_summary}"

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": context_text},
            ],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during summarization: {e}")
        raise HTTPException(status_code=503, detail="AI summarization failed.")

    try:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        result = json.loads(json_match.group()) if json_match else {}
    except Exception:
        result = {}

    doc.ai_summary = result.get("ai_summary", raw)
    doc.claim_guidance_notes = result.get("claim_guidance_notes", "")
    doc.assistant_ready = True
    doc = db_session.merge(doc)
    db_session.commit()
    db_session.refresh(doc)

    # Copy ai_summary into the intelligence record
    try:
        intel = crud.policy_intelligence.get_by_document(
            db_session, document_id=doc_id
        )
        if intel:
            intel.ai_summary = doc.ai_summary
            db_session.add(intel)
            db_session.commit()
    except Exception as e:
        logger.warning(f"Intelligence summary update failed (non-fatal): {e}")
        db_session.rollback()

    db_session.refresh(doc)
    return doc


# ── ASSISTANT ACTION ──────────────────────────────────────────────────

ASSISTANT_ACTION_PROMPTS = {
    "coverage_issues": (
        "Analyze this insurance policy and identify any gaps, concerns, or potential "
        "coverage issues. Look for inadequate limits, missing coverages, or areas where "
        "the insured may be underinsured. Be specific and reference policy language."
    ),
    "flag_exclusions": (
        "List ALL exclusions in this policy with a risk assessment for each. "
        "For each exclusion, explain what scenarios would NOT be covered and rate "
        "the risk level (low/medium/high) based on how commonly these exclusions "
        "affect claims."
    ),
    "matching_language": (
        "Find and quote all policy language related to matching — including but not "
        "limited to matching of materials, colors, patterns, siding, roofing, flooring, "
        "and any 'like kind and quality' provisions. Include exact quotes from the policy."
    ),
    "deductible_analysis": (
        "Break down the complete deductible structure of this policy. Include all "
        "deductible types (standard, wind/hail, hurricane, percentage-based, etc.), "
        "how they are calculated, and when each applies."
    ),
    "replacement_cost": (
        "Identify all language distinguishing between Replacement Cost Value (RCV) "
        "and Actual Cash Value (ACV). Explain what is covered at RCV vs ACV, "
        "any conditions for recovering depreciation, and holdback provisions."
    ),
    "supplement_support": (
        "Find policy language that supports supplement demands. Look for provisions "
        "about scope of repair, code upgrades, matching requirements, contractor "
        "overhead & profit, and any language an adjuster can cite when submitting "
        "a supplement to the carrier."
    ),
    "estimate_defense": (
        "Draft a professional estimate defense letter citing specific policy language. "
        "Reference coverage provisions, limits, matching requirements, and code "
        "compliance provisions that support the estimated repair scope and cost."
    ),
    "followup_letter": (
        "Draft a professional follow-up letter to the insurance carrier regarding "
        "this claim. Reference specific policy provisions, deadlines, and obligations. "
        "Maintain a firm but professional tone."
    ),
}


@router.post(
    "/{doc_id}/assistant-action",
    summary="AI: Policy Assistant Action",
    response_model=AssistantActionResponse,
    dependencies=[Depends(permissions.read())],
)
def assistant_action(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    body: AssistantActionRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Run a targeted AI action using policy knowledge."""
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    if body.action_type not in ASSISTANT_ACTION_PROMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action_type. Valid: {list(ASSISTANT_ACTION_PROMPTS.keys())}",
        )

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Build context
    clauses = crud.policy_clause.get_by_document(db_session, document_id=doc_id)
    extracted_text = doc.ai_extracted_text or ""

    clause_text = ""
    clause_ids = []
    if clauses:
        clause_lines = []
        for c in clauses:
            clause_ids.append(c.id)
            line = f"[{c.clause_type}] {c.title}"
            if c.amount:
                line += f" — ${c.amount:,.2f}"
            if c.raw_text:
                line += f'\n  Quote: "{c.raw_text[:500]}"'
            if c.summary:
                line += f"\n  Summary: {c.summary}"
            clause_lines.append(line)
        clause_text = "\n".join(clause_lines)

    action_prompt = ASSISTANT_ACTION_PROMPTS[body.action_type]

    context_parts = [f"POLICY: {doc.carrier or 'Unknown'} - {doc.policy_number or 'Unknown'}"]
    if doc.insured_name:
        context_parts.append(f"Insured: {doc.insured_name}")
    if body.claim_context:
        context_parts.append(f"CLAIM CONTEXT: {body.claim_context}")
    if clause_text:
        context_parts.append(f"EXTRACTED CLAUSES:\n{clause_text}")
    if extracted_text:
        context_parts.append(f"FULL POLICY TEXT:\n{extracted_text[:15000]}")

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=action_prompt,
            messages=[
                {"role": "user", "content": "\n\n".join(context_parts)},
            ],
        )
        result_text = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during assistant action: {e}")
        raise HTTPException(status_code=503, detail="AI assistant action failed.")

    return AssistantActionResponse(
        action_type=body.action_type,
        result_text=result_text,
        clauses_referenced=clause_ids,
    )


# ── GET DETAIL ──────────────────────────────────────────────────────────


@router.get(
    "/{doc_id}",
    summary="Get Policy Document",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.read())],
)
def get_policy_document(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve a single policy document detail."""
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")
    return doc


# ── UPDATE METADATA ─────────────────────────────────────────────────────


@router.patch(
    "/{doc_id}",
    summary="Update Policy Document Metadata",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.update())],
)
def update_policy_document(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    doc_in: PolicyDocumentUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update metadata on a policy document."""
    UserContext.set(current_user.id)
    doc = crud_util.get_object_or_raise_exception(db_session, object_id=doc_id)
    return crud.policy_document.update(db_session, db_obj=doc, obj_in=doc_in)


# ── SOFT DELETE ─────────────────────────────────────────────────────────


@router.delete(
    "/{doc_id}",
    summary="Delete Policy Document",
    dependencies=[Depends(permissions.remove())],
)
def delete_policy_document(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Soft-delete a policy document."""
    UserContext.set(current_user.id)
    doc = crud_util.get_object_or_raise_exception(db_session, object_id=doc_id)
    doc.is_removed = True
    db_session.add(doc)
    db_session.commit()
    return {"msg": "Policy document deleted successfully."}


# ── VERSION HISTORY ─────────────────────────────────────────────────────


@router.get(
    "/{doc_id}/versions",
    summary="Get Version History",
    response_model=list[PolicyDocumentList],
    dependencies=[Depends(permissions.read())],
)
def get_version_history(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Get all versions of a policy document."""
    return crud.policy_document.get_version_history(db_session, document_id=doc_id)


# ── UPLOAD NEW VERSION ──────────────────────────────────────────────────


@router.post(
    "/{doc_id}/new-version",
    summary="Upload New Version",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_new_version(
    doc_id: Annotated[UUID, Path(description="The parent policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="New version PDF.")],
) -> Any:
    """Upload a replacement/renewal version of a policy document."""
    UserContext.set(current_user.id)
    parent = crud.policy_document.get(db_session, obj_id=doc_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent document not found.")

    # Determine root parent
    root_id = parent.parent_id or parent.id

    # Get latest version number
    latest = crud.policy_document.get_latest_version(db_session, parent_id=root_id)
    new_version = (latest.version + 1) if latest else 2

    ext = get_file_extension(file.filename) if file.filename else ".pdf"
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{POLICY_VAULT_DIR}/{unique_name}"

    contents = await file.read()
    file_size = len(contents)
    await file.seek(0)

    try:
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.warning(f"S3 upload failed, falling back to local storage: {e}")
        _save_local(contents, unique_name)

    new_doc = PolicyDocument(
        file_name=file.filename or unique_name,
        file_key=storage_key,
        file_size=file_size,
        content_type=file.content_type or "application/pdf",
        parent_id=root_id,
        version=new_version,
        # Copy metadata from parent
        insured_name=parent.insured_name,
        carrier=parent.carrier,
        policy_number=parent.policy_number,
        claim_number=parent.claim_number,
        policy_type=parent.policy_type,
        property_address=parent.property_address,
        property_city=parent.property_city,
        property_state=parent.property_state,
        property_zip=parent.property_zip,
        claim_id=parent.claim_id,
        client_id=parent.client_id,
        lead_id=parent.lead_id,
        fire_claim_id=parent.fire_claim_id,
        adjuster_case_id=parent.adjuster_case_id,
    )
    db_session.add(new_doc)
    db_session.commit()
    db_session.refresh(new_doc)
    return new_doc


# ── AI: EXTRACT METADATA ───────────────────────────────────────────────


@router.post(
    "/{doc_id}/extract-metadata",
    summary="AI: Extract Policy Metadata",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.update())],
)
def extract_metadata(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Extract metadata from policy PDF using pdfplumber + OpenAI."""
    UserContext.set(current_user.id)
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    # Step 1: Extract text with pdfplumber
    extracted_text = doc.ai_extracted_text
    if not extracted_text:
        try:
            import pdfplumber

            # Try S3 first, fall back to local storage
            file_bytes = None
            try:
                downloaded = S3.download_files_from_s3([doc.file_key])
                if downloaded:
                    file_bytes, _ = downloaded[0]
            except Exception:
                pass
            if not file_bytes:
                file_bytes = _read_local(doc.file_key)
            if not file_bytes:
                raise HTTPException(
                    status_code=400, detail="Could not download PDF from storage."
                )
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                extracted_text = "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
            doc.ai_extracted_text = extracted_text
            db_session.add(doc)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"pdfplumber extraction failed for {doc.file_name}: {e}")
            doc.extraction_status = "failed"
            db_session.add(doc)
            db_session.commit()
            raise HTTPException(
                status_code=400, detail="Could not extract text from PDF."
            )

    if not extracted_text or not extracted_text.strip():
        doc.extraction_status = "failed"
        db_session.add(doc)
        db_session.commit()
        raise HTTPException(
            status_code=400, detail="PDF contains no extractable text."
        )

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Step 2: Send to Claude for metadata extraction
    system_prompt = (
        "You are an expert insurance policy analyst. Extract the following fields "
        "from the provided policy document text and return them as a JSON object:\n"
        '- "insured_name": string or null\n'
        '- "carrier": string or null\n'
        '- "policy_number": string or null\n'
        '- "policy_type": one of "homeowners", "fire", "commercial", "auto", "flood", "umbrella" or null\n'
        '- "effective_date": date string (YYYY-MM-DD) or null\n'
        '- "expiration_date": date string (YYYY-MM-DD) or null\n'
        '- "property_address": string or null\n'
        '- "property_city": string or null\n'
        '- "property_state": two-letter state code or null\n'
        '- "property_zip": string or null\n'
        '- "claim_number": string or null\n'
        "Return ONLY the JSON object, no other text."
    )

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {"role": "user", "content": extracted_text[:50000]},
            ],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during metadata extraction: {e}")
        doc.extraction_status = "failed"
        db_session.add(doc)
        db_session.commit()
        raise HTTPException(
            status_code=503, detail="AI metadata extraction failed."
        )

    # Step 3: Parse and populate
    doc.ai_metadata_json = raw
    try:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        metadata = json.loads(json_match.group()) if json_match else {}
    except Exception:
        metadata = {}

    if metadata:
        if metadata.get("insured_name"):
            doc.insured_name = metadata["insured_name"][:200]
        if metadata.get("carrier"):
            doc.carrier = metadata["carrier"][:200]
        if metadata.get("policy_number"):
            doc.policy_number = metadata["policy_number"][:100]
        if metadata.get("claim_number"):
            doc.claim_number = metadata["claim_number"][:100]
        if metadata.get("policy_type"):
            doc.policy_type = metadata["policy_type"][:64]
        if metadata.get("effective_date"):
            try:
                doc.effective_date = date.fromisoformat(metadata["effective_date"])
            except ValueError:
                pass
        if metadata.get("expiration_date"):
            try:
                doc.expiration_date = date.fromisoformat(metadata["expiration_date"])
            except ValueError:
                pass
        if metadata.get("property_address"):
            doc.property_address = metadata["property_address"][:256]
        if metadata.get("property_city"):
            doc.property_city = metadata["property_city"][:100]
        if metadata.get("property_state"):
            doc.property_state = metadata["property_state"][:2]
        if metadata.get("property_zip"):
            doc.property_zip = metadata["property_zip"][:10]
        doc.extraction_status = "completed"
    else:
        doc.extraction_status = "failed"

    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


# ── DETACH FROM ENTITY ─────────────────────────────────────────────────


@router.post(
    "/{doc_id}/detach",
    summary="Detach Policy from Entity",
    response_model=PolicyDocumentInDB,
    dependencies=[Depends(permissions.update())],
)
def detach_from_entity(
    doc_id: Annotated[UUID, Path(description="The policy document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    claim_id: bool = Query(False, description="Null the claim_id FK"),
    client_id: bool = Query(False, description="Null the client_id FK"),
    lead_id: bool = Query(False, description="Null the lead_id FK"),
    fire_claim_id: bool = Query(False, description="Null the fire_claim_id FK"),
    adjuster_case_id: bool = Query(
        False, description="Null the adjuster_case_id FK"
    ),
) -> Any:
    """Remove entity link without deleting the document."""
    UserContext.set(current_user.id)
    doc = crud.policy_document.get(db_session, obj_id=doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Policy document not found.")

    if claim_id:
        doc.claim_id = None
    if client_id:
        doc.client_id = None
    if lead_id:
        doc.lead_id = None
    if fire_claim_id:
        doc.fire_claim_id = None
    if adjuster_case_id:
        doc.adjuster_case_id = None

    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc
