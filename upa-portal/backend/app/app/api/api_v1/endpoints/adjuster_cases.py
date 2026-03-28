#!/usr/bin/env python

"""Routes for the AI Adjuster Assistant module"""

import json
import logging
import uuid as uuid_mod
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile, status
import anthropic
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.models.adjuster_case_document import AdjusterCaseDocument
from app.models.adjuster_case_policy_analysis import AdjusterCasePolicyAnalysis
from app.schemas.adjuster_case import AdjusterCaseInDB, AdjusterCaseList
from app.schemas.adjuster_case_document import AdjusterCaseDocumentInDB
from app.schemas.adjuster_case_policy_analysis import AdjusterCasePolicyAnalysisInDB
from app.schemas.estimate_project import EstimateProject as EstimateProjectSchema
from app.schemas.policy_clause import AssistantActionRequest, AssistantActionResponse
from app.utils.common import get_file_extension
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil, exc_internal_server
from app.utils.pagination import CustomPage
from app.utils.s3 import S3

logger = logging.getLogger(__name__)

router = APIRouter()

module = Modules.ADJUSTER_CASE
permissions = Permissions(module.value)
crud_util = CrudUtil(crud.adjuster_case)

ADJUSTER_CASE_FILE_DIR = "adjuster-cases"


def _ai_is_configured() -> bool:
    key = getattr(settings, "ANTHROPIC_API_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _get_claude_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── LIST ─────────────────────────────────────────────────────────────────

@router.get(
    "",
    summary="List Adjuster Cases",
    response_model=CustomPage[AdjusterCaseList],
    dependencies=[Depends(permissions.read())],
)
def list_cases(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Paginated list of adjuster cases."""
    return crud.adjuster_case.get_multi(db_session)


# ── CREATE ───────────────────────────────────────────────────────────────

@router.post(
    "",
    summary="Create Adjuster Case",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
def create_case(
    case_in: schemas.AdjusterCaseCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Create a new adjuster case (intake step)."""
    UserContext.set(current_user.id)
    case_number = crud.adjuster_case.auto_generate_case_number(db_session)

    # Build model dict from schema + generated fields
    data = case_in.dict()
    data["case_number"] = case_number
    data["status"] = "intake"
    data["current_step"] = 0

    from app.models.adjuster_case import AdjusterCase

    db_obj = AdjusterCase(**data)
    db_obj.created_by_id = current_user.id
    db_session.add(db_obj)
    db_session.commit()
    db_session.refresh(db_obj)
    return db_obj


# ── GET DETAIL ───────────────────────────────────────────────────────────

@router.get(
    "/{case_id}",
    summary="Get Adjuster Case",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.read())],
)
def get_case(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Retrieve an adjuster case with all details."""
    case = crud.adjuster_case.get_with_details(db_session, obj_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Adjuster case not found.")
    return case


# ── UPDATE ───────────────────────────────────────────────────────────────

@router.patch(
    "/{case_id}",
    summary="Update Adjuster Case",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.update())],
)
def update_case(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    case_in: schemas.AdjusterCaseUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Update fields on an adjuster case."""
    UserContext.set(current_user.id)
    case = crud_util.get_object_or_raise_exception(db_session, object_id=case_id)
    return crud.adjuster_case.update(db_session, db_obj=case, obj_in=case_in)


# ── ADVANCE STEP ─────────────────────────────────────────────────────────

@router.post(
    "/{case_id}/advance",
    summary="Advance to Next Step",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.update())],
)
def advance_step(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Advance the case to the next workflow step."""
    UserContext.set(current_user.id)
    case = crud_util.get_object_or_raise_exception(db_session, object_id=case_id)
    return crud.adjuster_case.advance_step(db_session, db_obj=case)


# ── DOCUMENTS ────────────────────────────────────────────────────────────

@router.post(
    "/{case_id}/documents",
    summary="Upload Document",
    response_model=AdjusterCaseDocumentInDB,
    dependencies=[Depends(permissions.create())],
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File(description="Document file.")],
    file_type: Annotated[str, Form(description="policy, photo, report, estimate, or other.")] = "other",
    step: Annotated[str, Form(description="Which step this upload belongs to.")] = "intake",
) -> Any:
    """Upload a document for an adjuster case."""
    UserContext.set(current_user.id)
    crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    ext = get_file_extension(file.filename) if file.filename else ""
    unique_name = f"{uuid_mod.uuid4()}{ext}"
    storage_key = f"{ADJUSTER_CASE_FILE_DIR}/{case_id}/{unique_name}"

    try:
        S3.upload_file_obj(file=file, object_name=storage_key)
    except Exception as e:
        logger.error(e)
        exc_internal_server("An error occurred while uploading the file.")

    doc = AdjusterCaseDocument(
        case_id=case_id,
        file_name=file.filename or unique_name,
        file_key=storage_key,
        file_type=file_type,
        step=step,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@router.get(
    "/{case_id}/documents",
    summary="List Documents",
    response_model=list[AdjusterCaseDocumentInDB],
    dependencies=[Depends(permissions.read())],
)
def list_documents(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """List all documents for a case."""
    case = crud.adjuster_case.get_with_details(db_session, obj_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Adjuster case not found.")
    return case.documents


@router.delete(
    "/{case_id}/documents/{doc_id}",
    summary="Delete Document",
    response_model=schemas.Msg,
    dependencies=[Depends(permissions.remove())],
)
def delete_document(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    doc_id: Annotated[UUID, Path(description="The document ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Delete a document from a case and remove from S3."""
    crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    doc = db_session.get(AdjusterCaseDocument, doc_id)
    if not doc or doc.case_id != case_id:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        S3.delete_file_obj(object_name=doc.file_key)
    except Exception as e:
        logger.error(e)

    db_session.delete(doc)
    db_session.commit()
    return {"msg": "Document deleted successfully."}


# ── AI: ANALYZE POLICY ──────────────────────────────────────────────────

@router.post(
    "/{case_id}/analyze-policy",
    summary="AI: Analyze Policy Document",
    response_model=list[AdjusterCasePolicyAnalysisInDB],
    dependencies=[Depends(permissions.update())],
)
def analyze_policy(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Extract policy info from uploaded PDF documents using AI.

    Fast path: if linked vault docs have assistant_ready=True with pre-extracted
    clauses, convert those clauses to AdjusterCasePolicyAnalysis records without
    calling OpenAI again.
    """
    case = crud.adjuster_case.get_with_details(db_session, obj_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Adjuster case not found.")

    # Collect text from policy documents (case docs + vault docs)
    policy_docs = [d for d in case.documents if d.file_type == "policy"]

    # Also include vault PolicyDocument records linked to this case
    vault_docs = crud.policy_document.get_by_entity(
        db_session, adjuster_case_id=case_id
    )

    if not policy_docs and not vault_docs:
        raise HTTPException(status_code=400, detail="No policy documents uploaded yet.")

    # ── Fast path: use PolicyIntelligence if available ──
    ready_vault_docs = [v for v in vault_docs if v.assistant_ready]
    if ready_vault_docs:
        results = []
        for vdoc in ready_vault_docs:
            intel = vdoc.intelligence
            if intel:
                # Build rich analysis records from consolidated intelligence
                coverage_fields = [
                    ("Coverage A — Dwelling", intel.coverage_a_dwelling),
                    ("Coverage B — Other Structures", intel.coverage_b_other_structures),
                    ("Coverage C — Personal Property", intel.coverage_c_personal_property),
                    ("Coverage D — Loss of Use", intel.coverage_d_loss_of_use),
                    ("Coverage E — Liability", intel.coverage_e_liability),
                    ("Coverage F — Medical", intel.coverage_f_medical),
                ]
                for label, amount in coverage_fields:
                    if amount:
                        analysis = AdjusterCasePolicyAnalysis(
                            case_id=case_id,
                            coverage_type=label,
                            limit_amount=float(amount),
                            deductible=None,
                            exclusions=None,
                            ai_confidence=intel.confidence_score or 0.8,
                            raw_ai_response=f"From policy intelligence: {intel.id}",
                        )
                        db_session.add(analysis)
                        results.append(analysis)

                # Deductibles
                if intel.deductible_amount:
                    analysis = AdjusterCasePolicyAnalysis(
                        case_id=case_id,
                        coverage_type="Standard Deductible",
                        limit_amount=None,
                        deductible=float(intel.deductible_amount),
                        exclusions=None,
                        ai_confidence=intel.confidence_score or 0.8,
                        raw_ai_response=f"From policy intelligence: {intel.id}",
                    )
                    db_session.add(analysis)
                    results.append(analysis)
                if intel.deductible_wind_hail:
                    analysis = AdjusterCasePolicyAnalysis(
                        case_id=case_id,
                        coverage_type="Wind/Hail Deductible",
                        limit_amount=None,
                        deductible=float(intel.deductible_wind_hail),
                        exclusions=None,
                        ai_confidence=intel.confidence_score or 0.8,
                        raw_ai_response=f"From policy intelligence: {intel.id}",
                    )
                    db_session.add(analysis)
                    results.append(analysis)
                if intel.deductible_hurricane:
                    analysis = AdjusterCasePolicyAnalysis(
                        case_id=case_id,
                        coverage_type="Hurricane Deductible",
                        limit_amount=None,
                        deductible=float(intel.deductible_hurricane),
                        exclusions=None,
                        ai_confidence=intel.confidence_score or 0.8,
                        raw_ai_response=f"From policy intelligence: {intel.id}",
                    )
                    db_session.add(analysis)
                    results.append(analysis)

                # Exclusions from JSON
                if intel.exclusions_json:
                    try:
                        excl_list = json.loads(intel.exclusions_json)
                        for excl in excl_list:
                            analysis = AdjusterCasePolicyAnalysis(
                                case_id=case_id,
                                coverage_type=f"Exclusion: {excl.get('title', 'Unknown')}",
                                limit_amount=None,
                                deductible=None,
                                exclusions=excl.get("summary", ""),
                                ai_confidence=intel.confidence_score or 0.8,
                                raw_ai_response=f"From policy intelligence: {intel.id}",
                            )
                            db_session.add(analysis)
                            results.append(analysis)
                    except Exception:
                        pass

                # Endorsements
                if intel.endorsements_json:
                    try:
                        end_list = json.loads(intel.endorsements_json)
                        for end in end_list:
                            analysis = AdjusterCasePolicyAnalysis(
                                case_id=case_id,
                                coverage_type=f"Endorsement: {end.get('title', 'Unknown')}",
                                limit_amount=None,
                                deductible=None,
                                exclusions=end.get("summary", ""),
                                ai_confidence=intel.confidence_score or 0.8,
                                raw_ai_response=f"From policy intelligence: {intel.id}",
                            )
                            db_session.add(analysis)
                            results.append(analysis)
                    except Exception:
                        pass
            else:
                # Fallback to clause-by-clause if no intelligence record
                clauses = crud.policy_clause.get_by_document(
                    db_session, document_id=vdoc.id
                )
                for c in clauses:
                    if c.clause_type in ("coverage", "limit", "deductible"):
                        analysis = AdjusterCasePolicyAnalysis(
                            case_id=case_id,
                            coverage_type=c.title,
                            limit_amount=c.amount if c.clause_type in ("coverage", "limit") else None,
                            deductible=c.amount if c.clause_type == "deductible" else None,
                            exclusions=None,
                            ai_confidence=c.ai_confidence,
                            raw_ai_response=f"From vault clause: {c.id}",
                        )
                        db_session.add(analysis)
                        results.append(analysis)
                    elif c.clause_type == "exclusion":
                        analysis = AdjusterCasePolicyAnalysis(
                            case_id=case_id,
                            coverage_type=f"Exclusion: {c.title}",
                            limit_amount=None,
                            deductible=None,
                            exclusions=c.summary or c.raw_text,
                            ai_confidence=c.ai_confidence,
                            raw_ai_response=f"From vault clause: {c.id}",
                        )
                        db_session.add(analysis)
                        results.append(analysis)

        if results:
            db_session.commit()
            for r in results:
                db_session.refresh(r)
            return results

    # ── Standard path: extract from PDF text via OpenAI ──
    all_text = ""

    # Include text from vault documents
    for vdoc in vault_docs:
        if vdoc.ai_extracted_text:
            all_text += vdoc.ai_extracted_text + "\n"

    for doc in policy_docs:
        if doc.ai_extracted_text:
            all_text += doc.ai_extracted_text + "\n"
        else:
            # Download from S3 and extract
            try:
                import io
                import pdfplumber

                downloaded = S3.download_files_from_s3([doc.file_key])
                if downloaded:
                    file_bytes, _ = downloaded[0]
                    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                        extracted = "\n".join(page.extract_text() or "" for page in pdf.pages)
                    doc.ai_extracted_text = extracted
                    db_session.add(doc)
                    all_text += extracted + "\n"
            except Exception as e:
                logger.warning(f"Could not extract text from {doc.file_name}: {e}")

    if not all_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from policy documents.")

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Call Claude
    system_prompt = (
        "You are an expert insurance policy analyst. Extract coverage types, limits, "
        "deductibles, and exclusions from the provided policy text. Return your answer "
        "as a JSON array of objects with keys: coverage_type, limit_amount (number or null), "
        "deductible (number or null), exclusions (string or null), confidence (0.0-1.0)."
    )

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": all_text[:30000]},
            ],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during policy analysis: {e}")
        raise HTTPException(status_code=503, detail="AI analysis failed. Please try again.")

    # Parse response
    try:
        import re
        json_match = re.search(r"\[.*\]", raw, re.DOTALL)
        coverages = json.loads(json_match.group()) if json_match else []
    except Exception:
        coverages = []

    # Store parsed results
    results = []
    for cov in coverages:
        analysis = AdjusterCasePolicyAnalysis(
            case_id=case_id,
            coverage_type=cov.get("coverage_type", "Unknown"),
            limit_amount=cov.get("limit_amount"),
            deductible=cov.get("deductible"),
            exclusions=cov.get("exclusions"),
            ai_confidence=cov.get("confidence", 0.0),
            raw_ai_response=raw,
        )
        db_session.add(analysis)
        results.append(analysis)

    db_session.commit()
    for r in results:
        db_session.refresh(r)

    return results


# ── ATTACH VAULT POLICY ────────────────────────────────────────────────

@router.post(
    "/{case_id}/attach-vault-policy",
    summary="Attach Vault Policy to Case",
    dependencies=[Depends(permissions.update())],
)
def attach_vault_policy(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    policy_document_id: UUID = None,
) -> Any:
    """Attach an existing vault policy document to this adjuster case."""
    UserContext.set(current_user.id)
    crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    if not policy_document_id:
        raise HTTPException(status_code=400, detail="policy_document_id is required.")

    from app.models.policy_document import PolicyDocument as PDModel
    vault_doc = db_session.get(PDModel, policy_document_id)
    if not vault_doc:
        raise HTTPException(status_code=404, detail="Vault policy document not found.")

    vault_doc.adjuster_case_id = case_id
    db_session.add(vault_doc)
    db_session.commit()
    db_session.refresh(vault_doc)
    return {"msg": "Vault policy attached to case.", "policy_document_id": str(vault_doc.id)}


# ── POLICY ACTION (intelligence) ──────────────────────────────────────

CASE_ACTION_PROMPTS = {
    "coverage_issues": "Analyze the policy and identify any gaps or coverage concerns for this claim.",
    "flag_exclusions": "List all exclusions with a risk assessment for this specific claim context.",
    "matching_language": "Find and quote all matching-related policy language.",
    "deductible_analysis": "Break down the complete deductible structure.",
    "replacement_cost": "Identify RCV vs ACV language and depreciation recovery conditions.",
    "supplement_support": "Find language supporting supplement demands.",
    "estimate_defense": "Draft an estimate defense letter citing policy language.",
    "followup_letter": "Draft a follow-up letter to the carrier using policy provisions.",
}


@router.post(
    "/{case_id}/policy-action",
    summary="AI: Policy Intelligence Action in Case Context",
    response_model=AssistantActionResponse,
    dependencies=[Depends(permissions.read())],
)
def policy_action(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    body: AssistantActionRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Run a policy knowledge action within the context of an adjuster case."""
    case = crud.adjuster_case.get_with_details(db_session, obj_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Adjuster case not found.")

    if body.action_type not in CASE_ACTION_PROMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action_type. Valid: {list(CASE_ACTION_PROMPTS.keys())}",
        )

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Pull linked vault docs + intelligence
    vault_docs = crud.policy_document.get_by_entity(
        db_session, adjuster_case_id=case_id
    )

    clause_text = ""
    clause_ids = []
    policy_text = ""
    intelligence_context = ""

    for vdoc in vault_docs:
        intel = vdoc.intelligence
        if intel:
            # Build structured intelligence context
            intel_parts = []
            if intel.coverage_a_dwelling:
                intel_parts.append(f"Coverage A (Dwelling): ${float(intel.coverage_a_dwelling):,.2f}")
            if intel.coverage_b_other_structures:
                intel_parts.append(f"Coverage B (Other Structures): ${float(intel.coverage_b_other_structures):,.2f}")
            if intel.coverage_c_personal_property:
                intel_parts.append(f"Coverage C (Personal Property): ${float(intel.coverage_c_personal_property):,.2f}")
            if intel.coverage_d_loss_of_use:
                intel_parts.append(f"Coverage D (Loss of Use): ${float(intel.coverage_d_loss_of_use):,.2f}")
            if intel.coverage_e_liability:
                intel_parts.append(f"Coverage E (Liability): ${float(intel.coverage_e_liability):,.2f}")
            if intel.coverage_f_medical:
                intel_parts.append(f"Coverage F (Medical): ${float(intel.coverage_f_medical):,.2f}")
            if intel.deductible_amount:
                intel_parts.append(f"Deductible: ${float(intel.deductible_amount):,.2f}")
            if intel.deductible_wind_hail:
                intel_parts.append(f"Wind/Hail Deductible: ${float(intel.deductible_wind_hail):,.2f}")
            if intel.deductible_hurricane:
                intel_parts.append(f"Hurricane Deductible: ${float(intel.deductible_hurricane):,.2f}")
            if intel.replacement_cost_language:
                intel_parts.append(f"Replacement Cost: {intel.replacement_cost_language[:300]}")
            if intel.matching_language:
                intel_parts.append(f"Matching: {intel.matching_language[:300]}")
            if intel.loss_settlement_clause:
                intel_parts.append(f"Loss Settlement: {intel.loss_settlement_clause[:300]}")
            if intel.appraisal_clause:
                intel_parts.append(f"Appraisal: {intel.appraisal_clause[:300]}")
            if intel.ordinance_and_law:
                intel_parts.append(f"Ordinance & Law: {intel.ordinance_and_law[:300]}")
            if intel.duties_after_loss:
                intel_parts.append(f"Duties After Loss: {intel.duties_after_loss[:300]}")
            if intel.deadline_notice_details:
                intel_parts.append(f"Deadlines/Notices: {intel.deadline_notice_details[:300]}")
            if intel_parts:
                intelligence_context += "\n".join(intel_parts) + "\n"

        # Also include clause details
        clauses = crud.policy_clause.get_by_document(
            db_session, document_id=vdoc.id
        )
        for c in clauses:
            clause_ids.append(c.id)
            line = f"[{c.clause_type}] {c.title}"
            if c.amount:
                line += f" — ${c.amount:,.2f}"
            if c.raw_text:
                line += f'\n  Quote: "{c.raw_text[:500]}"'
            if c.summary:
                line += f"\n  Summary: {c.summary}"
            clause_text += line + "\n"
        if vdoc.ai_extracted_text:
            policy_text += vdoc.ai_extracted_text[:5000] + "\n"

    # Build case context
    case_context = (
        f"Insured: {case.intake_insured_name or 'N/A'}\n"
        f"Address: {case.intake_address or 'N/A'}\n"
        f"Loss Date: {case.intake_loss_date or 'N/A'}\n"
        f"Loss Type: {case.intake_loss_type or 'N/A'}\n"
        f"Carrier: {case.intake_carrier or 'N/A'}\n"
        f"Claim #: {case.intake_claim_number or 'N/A'}"
    )
    if body.claim_context:
        case_context += f"\nAdditional Context: {body.claim_context}"

    context_parts = [f"CASE CONTEXT:\n{case_context}"]
    if intelligence_context:
        context_parts.append(f"POLICY INTELLIGENCE:\n{intelligence_context}")
    if clause_text:
        context_parts.append(f"EXTRACTED CLAUSES:\n{clause_text}")
    if policy_text:
        context_parts.append(f"POLICY TEXT:\n{policy_text}")

    action_prompt = CASE_ACTION_PROMPTS[body.action_type]

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
        logger.error(f"Claude error during case policy action: {e}")
        raise HTTPException(status_code=503, detail="AI policy action failed.")

    return AssistantActionResponse(
        action_type=body.action_type,
        result_text=result_text,
        clauses_referenced=clause_ids,
    )


# ── AI: ANALYZE DAMAGE (scaffolded) ─────────────────────────────────────

@router.post(
    "/{case_id}/analyze-damage",
    summary="AI: Analyze Damage (Scaffolded)",
    dependencies=[Depends(permissions.update())],
)
def analyze_damage(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Scaffolded — AI damage analysis from photos will be available in a future release."""
    UserContext.set(current_user.id)
    case = crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    placeholder = "AI damage analysis will be available in a future release. Upload photos and add manual damage notes."
    case.damage_ai_summary = placeholder
    db_session.add(case)
    db_session.commit()

    return {
        "status": "scaffolded",
        "message": placeholder,
    }


# ── AI: GENERATE SCOPE ──────────────────────────────────────────────────

@router.post(
    "/{case_id}/generate-scope",
    summary="AI: Generate Scope Summary",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.update())],
)
def generate_scope(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Generate an AI scope-of-work summary from intake + policy + damage data."""
    UserContext.set(current_user.id)
    case = crud.adjuster_case.get_with_details(db_session, obj_id=case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Adjuster case not found.")

    if not _ai_is_configured():
        raise HTTPException(status_code=503, detail="Anthropic API is not configured.")

    # Build context
    context_parts = [
        f"Insured: {case.intake_insured_name or 'N/A'}",
        f"Address: {case.intake_address or 'N/A'}",
        f"Loss Date: {case.intake_loss_date or 'N/A'}",
        f"Loss Type: {case.intake_loss_type or 'N/A'}",
        f"Carrier: {case.intake_carrier or 'N/A'}",
        f"Policy #: {case.intake_policy_number or 'N/A'}",
        f"Claim #: {case.intake_claim_number or 'N/A'}",
        f"Intake Notes: {case.intake_notes or 'None'}",
        f"Damage Summary: {case.damage_ai_summary or 'None'}",
        f"Manual Scope Notes: {case.scope_notes or 'None'}",
    ]

    # Add policy analysis
    if case.policy_analyses:
        context_parts.append("\nPolicy Coverages:")
        for pa in case.policy_analyses:
            context_parts.append(
                f"  - {pa.coverage_type}: limit={pa.limit_amount}, "
                f"deductible={pa.deductible}, exclusions={pa.exclusions}"
            )

    # Add policy intelligence from linked vault docs
    vault_docs = crud.policy_document.get_by_entity(
        db_session, adjuster_case_id=case_id
    )
    for vdoc in vault_docs:
        intel = vdoc.intelligence
        if intel:
            intel_lines = ["\nPolicy Intelligence:"]
            if intel.deductible_amount:
                intel_lines.append(f"  Deductible: ${float(intel.deductible_amount):,.2f}")
            if intel.deductible_wind_hail:
                intel_lines.append(f"  Wind/Hail Deductible: ${float(intel.deductible_wind_hail):,.2f}")
            if intel.replacement_cost_language:
                intel_lines.append(f"  Replacement Cost: {intel.replacement_cost_language[:200]}")
            if intel.matching_language:
                intel_lines.append(f"  Matching: {intel.matching_language[:200]}")
            if intel.ordinance_and_law:
                intel_lines.append(f"  Ordinance & Law: {intel.ordinance_and_law[:200]}")
            if intel.loss_settlement_clause:
                intel_lines.append(f"  Loss Settlement: {intel.loss_settlement_clause[:200]}")
            if len(intel_lines) > 1:
                context_parts.extend(intel_lines)

    context = "\n".join(context_parts)

    system_prompt = (
        "You are a licensed public adjuster writing a scope of work for an insurance claim. "
        "Output ONLY a plain-text scope organized by room or area. Do NOT use markdown formatting "
        "(no **, ##, or bullet symbols). Use this exact format:\n\n"
        "ROOM/AREA NAME\n"
        "- Action item: description (quantity, unit, measurement if applicable)\n\n"
        "Each action item must be a specific construction or repair task such as: "
        "remove damaged drywall, replace insulation, install new flooring, paint walls, "
        "replace baseboards, repair roof sheathing, install new shingles, etc.\n\n"
        "Do NOT include administrative tasks like 'finalize assessment', 'submit proof of loss', "
        "'coordinate with carrier', or 'schedule inspection'.\n\n"
        "End with a GENERAL CONDITIONS section for items like: "
        "debris removal, content manipulation, dumpster, permits, supervision.\n\n"
        "Be thorough. Include measurements and quantities where the data supports it."
    )

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": context},
            ],
        )
        scope_text = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during scope generation: {e}")
        raise HTTPException(status_code=503, detail="AI scope generation failed.")

    case.scope_ai_summary = scope_text
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case


# ── LINK ESTIMATE ────────────────────────────────────────────────────────

@router.post(
    "/{case_id}/link-estimate",
    summary="Link or Create Estimate Project",
    response_model=EstimateProjectSchema,
    dependencies=[Depends(permissions.update())],
)
def link_estimate(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Link an existing or create a new EstimateProject for the case."""
    UserContext.set(current_user.id)
    case = crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    if case.estimate_project_id:
        project = crud.estimate_project.get_with_details(
            db_session, obj_id=case.estimate_project_id
        )
        if project:
            return project

    # Create a new estimate project
    loss_date_str = case.intake_loss_date.strftime("%m/%d/%Y") if case.intake_loss_date else ""
    project_name = f"Adjuster Case – {case.intake_address or 'Unknown'} – {loss_date_str}"

    from app.schemas.estimate_project import EstimateProjectCreate

    project_in = EstimateProjectCreate(name=project_name)
    project = crud.estimate_project.create_with_rooms(db_session, obj_in=project_in)

    case.estimate_project_id = project.id
    db_session.add(case)
    db_session.commit()

    return crud.estimate_project.get_with_details(db_session, obj_id=project.id)


# ── PA APPROVAL ──────────────────────────────────────────────────────────

@router.post(
    "/{case_id}/pa-approve",
    summary="PA Approval",
    response_model=AdjusterCaseInDB,
    dependencies=[Depends(permissions.update())],
)
def pa_approve(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    pa_notes: str | None = None,
) -> Any:
    """Approve the case — requires PA role."""
    UserContext.set(current_user.id)
    case = crud_util.get_object_or_raise_exception(db_session, object_id=case_id)

    case.pa_approved = True
    case.pa_approved_at = datetime.now(timezone.utc)
    case.pa_notes = pa_notes
    case.assigned_pa_id = current_user.id
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case


# ── GENERATE REPORT (scaffolded) ────────────────────────────────────────

@router.post(
    "/{case_id}/generate-report",
    summary="Generate Final Report (Scaffolded)",
    dependencies=[Depends(permissions.update())],
)
def generate_report(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Scaffolded — PDF report generation will be available in a future release."""
    crud_util.get_object_or_raise_exception(db_session, object_id=case_id)
    return {
        "status": "scaffolded",
        "message": "PDF report generation will be available in a future release.",
    }


# ── AUDIT LOG (scaffolded) ──────────────────────────────────────────────

@router.get(
    "/{case_id}/audit-log",
    summary="Get Audit Log (Scaffolded)",
    dependencies=[Depends(permissions.read())],
)
def get_audit_log(
    case_id: Annotated[UUID, Path(description="The adjuster case ID.")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Scaffolded — step history will be available in a future release."""
    crud_util.get_object_or_raise_exception(db_session, object_id=case_id)
    return {
        "status": "scaffolded",
        "message": "Audit log will be available in a future release.",
        "entries": [],
    }
