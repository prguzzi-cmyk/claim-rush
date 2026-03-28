#!/usr/bin/env python

"""Routes for the Defense Notes module"""

import json
import logging
from typing import Annotated, Any
from uuid import UUID

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app import crud, models
from app.api.deps import Permissions, get_current_active_user, get_db_session
from app.core.config import settings
from app.core.rbac import Modules
from app.schemas.carrier_comparison import (
    DefenseNoteDraftRequest,
    DefenseNoteDraftResponse,
)
from app.schemas.defense_note import (
    DefenseNote,
    DefenseNoteUpdate,
)
from app.utils.contexts import UserContext
from app.utils.exceptions import CrudUtil

logger = logging.getLogger(__name__)

router = APIRouter()

module = Modules.ESTIMATE_PROJECT
permissions = Permissions(module.value)
crud_util_project = CrudUtil(crud.estimate_project)

# ── Section-specific system prompts ──────────────────────────────

SECTION_PROMPTS = {
    "pricing_defense": (
        "You are a licensed public adjuster writing a pricing defense section for a supplement demand. "
        "Your goal is to justify the ACI unit pricing against the carrier's lower pricing. "
        "Reference applicable pricing databases (Xactimate, RSMeans), local market labor rates, "
        "material costs, and any code-required specifications that affect pricing. "
        "Cite specific items from the comparison data where the carrier underpaid. "
        "Include dollar amounts for each disputed item."
    ),
    "omitted_scope_defense": (
        "You are a licensed public adjuster writing an omitted-scope defense section for a supplement demand. "
        "Your goal is to explain why items the carrier omitted from their estimate are necessary "
        "for proper restoration to pre-loss condition. "
        "Reference building codes, manufacturer installation requirements, industry standards (IICRC S500/S520), "
        "and construction sequencing requirements. "
        "Group omitted items by room and explain why each is required."
    ),
    "matching_continuity_defense": (
        "You are a licensed public adjuster writing a matching and continuity rationale for a supplement demand. "
        "Your goal is to argue that partial repairs create a mismatch in appearance and function, "
        "and that the policy requires like-kind-and-quality restoration. "
        "Reference matching requirements for flooring continuity, roofing uniformity, paint color matching, "
        "siding runs, and similar materials that cannot be partially replaced without visible discontinuity. "
        "Cite policy language about 'like kind and quality' if available."
    ),
    "quantity_scope_defense": (
        "You are a licensed public adjuster writing a quantity and scope correction rationale for a supplement demand. "
        "Your goal is to explain measurement corrections based on field inspection findings. "
        "Reference actual dimensions vs. carrier's assumed dimensions, areas the carrier missed during inspection, "
        "and scope items that are visible in photos or confirmed by field measurements. "
        "Include specific quantity differences with units (SF, LF, EA) where available."
    ),
    "code_standard_support": (
        "You are a licensed public adjuster writing a code and standard support section for a supplement demand. "
        "Your goal is to cite specific building codes, manufacturer specifications, and industry standards "
        "that require the scope or pricing in the ACI estimate. "
        "Reference applicable codes: International Building Code (IBC), International Residential Code (IRC), "
        "National Electrical Code (NEC), local amendments, OSHA requirements, IICRC standards, "
        "and manufacturer installation guidelines. "
        "Connect each code reference to specific line items in the comparison."
    ),
    "recommended_action_notes": (
        "You are a licensed public adjuster writing a recommended next action section for a supplement demand package. "
        "Based on the comparison data and claim context, recommend specific next steps. "
        "Consider whether to: request reinspection, file a supplement demand, escalate to appraisal, "
        "request an umpire, or initiate mediation. "
        "Include a suggested timeline and any deadlines the adjuster should be aware of. "
        "Be direct and actionable."
    ),
}

VALID_SECTIONS = set(SECTION_PROMPTS.keys())


def _ai_is_configured() -> bool:
    """Check if Anthropic Claude API key is configured."""
    key = getattr(settings, "ANTHROPIC_API_KEY", "")
    return bool(key) and "placeholder" not in key.lower()


def _get_claude_client() -> anthropic.Anthropic:
    """Return a configured Anthropic client."""
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── CRUD Routes ──────────────────────────────────────────────────


@router.get(
    "/{project_id}/defense-notes",
    summary="Get defense notes for a project",
    response_description="The defense notes or empty defaults",
    dependencies=[Depends(permissions.read())],
)
async def get_defense_notes(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> DefenseNote | dict:
    """Retrieve defense notes for an estimate project.

    Returns the stored notes or an empty dict if none exist yet.
    """
    crud_util_project.get_object_or_raise_exception(db_session, project_id)
    notes = crud.defense_note.get_by_project(
        db_session=db_session, project_id=project_id
    )
    if notes:
        return notes
    return {}


@router.put(
    "/{project_id}/defense-notes",
    summary="Save defense notes for a project",
    response_description="The saved defense notes",
    dependencies=[Depends(permissions.create())],
)
async def save_defense_notes(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    notes_in: DefenseNoteUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> DefenseNote:
    """Create or update defense notes for an estimate project.

    Uses upsert — creates a new record if none exists, otherwise
    updates the existing one.
    """
    UserContext.set(current_user.id)
    crud_util_project.get_object_or_raise_exception(db_session, project_id)

    return crud.defense_note.upsert(
        db_session=db_session,
        project_id=project_id,
        obj_in=notes_in,
    )


# ── AI Draft Generation ─────────────────────────────────────────


@router.post(
    "/{project_id}/defense-notes/generate",
    summary="Generate AI draft for a defense section",
    response_description="AI-generated draft text for the requested section",
    response_model=DefenseNoteDraftResponse,
    dependencies=[Depends(permissions.create())],
)
def generate_defense_draft(
    project_id: Annotated[UUID, Path(description="Estimate project ID")],
    body: DefenseNoteDraftRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[models.User, Depends(get_current_active_user)],
) -> Any:
    """Generate an AI draft for a specific defense section.

    Uses the same claim/comparison context as supplement argument
    generation, but with a section-specific prompt that produces
    focused, editable defense language.
    """

    # Validate section
    if body.section not in VALID_SECTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid section. Must be one of: {', '.join(sorted(VALID_SECTIONS))}",
        )

    if not _ai_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Anthropic API is not configured.",
        )

    # Load estimate project
    project = crud.estimate_project.get_with_details(
        db_session, obj_id=project_id
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimate project not found.",
        )

    fire_claim = project.fire_claim
    fire_claim_id = fire_claim.id if fire_claim else None

    # Load comparison result — required
    comparison = crud.carrier_comparison.get_by_project(
        db_session, project_id=project_id
    )
    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No carrier comparison found. Run a carrier comparison first.",
        )

    comparison_rooms = []
    if comparison.comparison_data:
        try:
            comparison_rooms = json.loads(comparison.comparison_data)
        except (json.JSONDecodeError, Exception):
            pass

    # Optionally load policy docs/clauses/intelligence
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

    # ── Build context ─────────────────────────────────────────

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

    context_parts.append(
        f"CARRIER: {carrier}\n"
        f"INSURED: {insured}\n"
        f"CLAIM NUMBER: {claim_num}"
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

    # Item breakdown — filter by section relevance
    if comparison_rooms:
        diff_lines = []
        for room in comparison_rooms:
            room_name = room.get("room_name", "Unknown")
            for item in room.get("items", []):
                item_status = item.get("status", "")
                # For omitted scope defense, focus on aci_only items
                if body.section == "omitted_scope_defense" and item_status != "aci_only":
                    continue
                # For pricing/quantity defense, focus on price_diff items
                if body.section in ("pricing_defense", "quantity_scope_defense") and item_status != "price_diff":
                    continue
                # For other sections, include all non-match items
                if body.section not in ("omitted_scope_defense", "pricing_defense", "quantity_scope_defense") and item_status == "match":
                    continue

                desc = item.get("description", "")
                aci = item.get("aci_total") or 0
                carr = item.get("carrier_total") or 0
                aci_qty = item.get("aci_quantity", "")
                carr_qty = item.get("carrier_quantity", "")
                aci_unit = item.get("aci_unit_cost") or 0
                carr_unit = item.get("carrier_unit_cost") or 0

                line = f"  [{room_name}] {desc} — ACI: ${aci:,.2f} | Carrier: ${carr:,.2f} ({item_status})"
                if aci_qty and carr_qty:
                    line += f" | Qty: ACI {aci_qty} vs Carrier {carr_qty}"
                if aci_unit and carr_unit:
                    line += f" | Unit: ACI ${aci_unit:,.2f} vs Carrier ${carr_unit:,.2f}"
                diff_lines.append(line)

                if len(diff_lines) >= 50:
                    break
            if len(diff_lines) >= 50:
                break

        if diff_lines:
            context_parts.append(
                "RELEVANT LINE ITEMS:\n" + "\n".join(diff_lines)
            )

    # Coverage limits
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

    # Policy clauses (especially useful for code_standard_support and matching)
    if clauses:
        clause_lines = []
        for c in clauses:
            line = f"[{c.clause_type}] {c.title}"
            if c.amount:
                line += f" — ${c.amount:,.2f}"
            if c.raw_text:
                line += f'\n  Quote: "{c.raw_text[:500]}"'
            if c.summary:
                line += f"\n  Summary: {c.summary}"
            clause_lines.append(line)
        context_parts.append("POLICY CLAUSES:\n" + "\n".join(clause_lines))

    # ── System prompt ─────────────────────────────────────────

    section_instruction = SECTION_PROMPTS[body.section]
    system_prompt = (
        f"{section_instruction}\n\n"
        "FORMATTING RULES:\n"
        "- Write in plain text only. No markdown (**, ##, *, bullets).\n"
        "- Use line breaks and indentation for structure.\n"
        "- Include specific dollar amounts from the comparison data.\n"
        "- Reference specific items by room name and description.\n"
        "- Keep the tone firm but professional, suitable for carrier correspondence.\n"
        "- Write 3-6 paragraphs of focused defense language.\n"
        "- Do not include any meta-commentary, headers, or instructions.\n"
        "- This text will be inserted directly into a defense package section."
    )

    # ── Call Claude ────────────────────────────────────────────

    try:
        client = _get_claude_client()
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=3000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": "\n\n".join(context_parts)},
            ],
        )
        draft_text = response.content[0].text
    except Exception as e:
        logger.error(f"Claude error during defense draft generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI defense draft generation failed. Please try again.",
        )

    return DefenseNoteDraftResponse(
        section=body.section,
        draft_text=draft_text,
        has_policy_support=has_policy_support,
    )
