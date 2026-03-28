#!/usr/bin/env python

"""Core comparison engine for ACI vs carrier estimates"""

import logging
import re
from collections import defaultdict

from app.models.carrier_estimate import CarrierLineItem
from app.models.estimate_room import EstimateRoom
from app.schemas.carrier_comparison import (
    CategoryBreakdown,
    ComparisonLineItem,
    ComparisonRoom,
    ComparisonResult,
    TopUnderpaidItem,
)

logger = logging.getLogger(__name__)


def _normalize(description: str | None) -> str:
    """Normalize a description for matching."""
    if not description:
        return ""
    s = description.lower().strip()
    # Remove common prefixes
    s = re.sub(r"^(r&r|remove\s*(&|and)\s*replace|remove\s*&\s*reinstall)\s*", "", s)
    # Remove punctuation and extra whitespace
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _jaccard_similarity(a: str, b: str) -> float:
    """Token overlap Jaccard similarity."""
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def _compute_match_score(
    aci_desc_norm: str,
    carrier_desc_norm: str,
    aci_qty: float | None,
    carrier_qty: float | None,
    aci_unit: str | None,
    carrier_unit: str | None,
    aci_category: str | None,
    carrier_category: str | None,
) -> float:
    """Weighted multi-factor matching score (0.0 – 1.0).

    Weights:
      Description similarity  60%
      Quantity proximity       20%
      Unit match               10%
      Category match           10%
    """
    # Description (60%)
    if aci_desc_norm == carrier_desc_norm and aci_desc_norm:
        desc_score = 1.0
    else:
        desc_score = _jaccard_similarity(aci_desc_norm, carrier_desc_norm)

    # Quantity proximity (20%)
    aq = aci_qty or 0
    cq = carrier_qty or 0
    max_q = max(aq, cq)
    if max_q > 0:
        qty_score = 1.0 - min(abs(aq - cq) / max_q, 1.0)
    else:
        qty_score = 1.0  # both zero/null — no penalty

    # Unit match (10%)
    unit_score = 1.0 if (aci_unit or "").lower() == (carrier_unit or "").lower() else 0.0

    # Category match (10%)
    cat_score = 1.0 if (aci_category or "").lower() == (carrier_category or "").lower() and aci_category else 0.0

    return 0.60 * desc_score + 0.20 * qty_score + 0.10 * unit_score + 0.10 * cat_score


def _match_confidence(score: float) -> str:
    """Return match confidence label from score."""
    if score >= 0.90:
        return "high"
    if score >= 0.70:
        return "medium"
    return "low"


def _fuzzy_match_room(room_name: str | None, aci_rooms: list[EstimateRoom]) -> EstimateRoom | None:
    """Find the best matching ACI room for a carrier room name."""
    if not room_name:
        return None

    normalized = room_name.lower().strip()
    best_match = None
    best_score = 0.0

    for room in aci_rooms:
        room_norm = (room.name or "").lower().strip()
        # Exact match
        if room_norm == normalized:
            return room
        # Substring match
        if normalized in room_norm or room_norm in normalized:
            score = 0.8
            if score > best_score:
                best_score = score
                best_match = room
        # Token overlap
        else:
            score = _jaccard_similarity(normalized, room_norm)
            if score > best_score:
                best_score = score
                best_match = room

    return best_match if best_score >= 0.4 else None


def run_comparison(
    aci_rooms: list[EstimateRoom],
    carrier_items: list[CarrierLineItem],
    price_threshold: float = 5.0,
) -> ComparisonResult:
    """
    Compare ACI estimate rooms/items against carrier line items.

    Returns a ComparisonResult with per-room breakdown and totals.
    """
    result = ComparisonResult(price_threshold=price_threshold)

    # Group carrier items by room
    carrier_by_room: dict[str, list[CarrierLineItem]] = defaultdict(list)
    for ci in carrier_items:
        # Use matched_room_id first, then room_name
        room_key = None
        if ci.matched_room_id:
            for room in aci_rooms:
                if room.id == ci.matched_room_id:
                    room_key = room.name
                    break
        if not room_key:
            matched_room = _fuzzy_match_room(ci.room_name, aci_rooms)
            room_key = matched_room.name if matched_room else (ci.room_name or "Unmatched")
        carrier_by_room[room_key].append(ci)

    # Process each ACI room
    all_room_names = set()
    for room in aci_rooms:
        all_room_names.add(room.name)
    for rn in carrier_by_room:
        all_room_names.add(rn)

    aci_total = 0.0
    carrier_total = 0.0
    supplement_total = 0.0

    for room_name in sorted(all_room_names):
        comp_room = ComparisonRoom(room_name=room_name)

        # Get ACI items for this room
        aci_items_for_room = []
        for room in aci_rooms:
            if room.name == room_name and room.line_items:
                aci_items_for_room = list(room.line_items)
                break

        carrier_items_for_room = list(carrier_by_room.get(room_name, []))

        # Track which items have been matched
        aci_matched = set()
        carrier_matched = set()

        # Phase 1: Exact normalized description match
        for ai, aci_item in enumerate(aci_items_for_room):
            aci_norm = _normalize(aci_item.description)
            if not aci_norm:
                continue

            for ci_idx, ci in enumerate(carrier_items_for_room):
                if ci_idx in carrier_matched:
                    continue
                carrier_norm = _normalize(ci.description)
                if aci_norm == carrier_norm:
                    aci_matched.add(ai)
                    carrier_matched.add(ci_idx)
                    score = _compute_match_score(
                        aci_norm, carrier_norm,
                        aci_item.quantity, ci.quantity,
                        aci_item.unit, ci.unit,
                        aci_item.category, ci.category,
                    )
                    _add_comparison_item(
                        comp_room, result, aci_item, ci, price_threshold,
                        match_score=score,
                        match_confidence=_match_confidence(score),
                    )
                    break

        # Phase 2: Weighted multi-factor fuzzy match
        for ai, aci_item in enumerate(aci_items_for_room):
            if ai in aci_matched:
                continue
            aci_norm = _normalize(aci_item.description)
            if not aci_norm:
                continue

            best_ci_idx = None
            best_score = 0.0
            for ci_idx, ci in enumerate(carrier_items_for_room):
                if ci_idx in carrier_matched:
                    continue
                carrier_norm = _normalize(ci.description)
                score = _compute_match_score(
                    aci_norm, carrier_norm,
                    aci_item.quantity, ci.quantity,
                    aci_item.unit, ci.unit,
                    aci_item.category, ci.category,
                )
                if score > best_score:
                    best_score = score
                    best_ci_idx = ci_idx

            if best_ci_idx is not None and best_score >= 0.55:
                aci_matched.add(ai)
                carrier_matched.add(best_ci_idx)
                _add_comparison_item(
                    comp_room, result, aci_item,
                    carrier_items_for_room[best_ci_idx], price_threshold,
                    match_score=best_score,
                    match_confidence=_match_confidence(best_score),
                )
            else:
                # ACI only
                aci_t = aci_item.total_cost or (
                    (aci_item.quantity or 1) * (aci_item.unit_cost or 0)
                )
                comp_room.items.append(ComparisonLineItem(
                    room_name=room_name,
                    description=aci_item.description,
                    aci_quantity=aci_item.quantity,
                    aci_unit=aci_item.unit,
                    aci_unit_cost=aci_item.unit_cost,
                    aci_total=aci_t,
                    status="aci_only",
                    category=aci_item.category,
                ))
                result.aci_only_count += 1
                supplement_total += aci_t or 0

        # Carrier-only items
        for ci_idx, ci in enumerate(carrier_items_for_room):
            if ci_idx in carrier_matched:
                continue
            carrier_t = ci.total_cost or ((ci.quantity or 1) * (ci.unit_cost or 0))
            comp_room.items.append(ComparisonLineItem(
                room_name=room_name,
                description=ci.description,
                carrier_quantity=ci.quantity,
                carrier_unit=ci.unit,
                carrier_unit_cost=ci.unit_cost,
                carrier_total=carrier_t,
                status="carrier_only",
                category=ci.category,
            ))
            result.carrier_only_count += 1

        # Compute room totals
        for item in comp_room.items:
            comp_room.aci_subtotal += item.aci_total or 0
            comp_room.carrier_subtotal += item.carrier_total or 0
        comp_room.difference = comp_room.aci_subtotal - comp_room.carrier_subtotal

        aci_total += comp_room.aci_subtotal
        carrier_total += comp_room.carrier_subtotal

        if comp_room.items:
            result.rooms.append(comp_room)

    result.aci_total = aci_total
    result.carrier_total = carrier_total
    result.supplement_total += supplement_total

    # ── Category Breakdown ────────────────────────────────────────
    cat_map: dict[str, CategoryBreakdown] = {}
    for room in result.rooms:
        for item in room.items:
            cat = item.category or "Uncategorized"
            if cat not in cat_map:
                cat_map[cat] = CategoryBreakdown(category=cat)
            cb = cat_map[cat]
            cb.aci_total += item.aci_total or 0
            cb.carrier_total += item.carrier_total or 0
            cb.item_count += 1
    for cb in cat_map.values():
        cb.difference = cb.aci_total - cb.carrier_total
    result.category_breakdown = sorted(cat_map.values(), key=lambda c: abs(c.difference), reverse=True)

    # ── Top Underpaid Items (price_diff + aci_only, top 10) ──────
    candidates: list[TopUnderpaidItem] = []
    for room in result.rooms:
        for item in room.items:
            if item.status == "price_diff" and (item.difference or 0) > 0:
                candidates.append(TopUnderpaidItem(
                    description=item.description or "",
                    room_name=item.room_name,
                    aci_total=item.aci_total or 0,
                    carrier_total=item.carrier_total or 0,
                    difference=item.difference or 0,
                    status="price_diff",
                ))
            elif item.status == "aci_only":
                candidates.append(TopUnderpaidItem(
                    description=item.description or "",
                    room_name=item.room_name,
                    aci_total=item.aci_total or 0,
                    carrier_total=0,
                    difference=item.aci_total or 0,
                    status="aci_only",
                ))
    candidates.sort(key=lambda c: abs(c.difference), reverse=True)
    result.top_underpaid_items = candidates[:10]

    return result


def _add_comparison_item(
    comp_room: ComparisonRoom,
    result: ComparisonResult,
    aci_item,
    carrier_item: CarrierLineItem,
    price_threshold: float,
    match_score: float | None = None,
    match_confidence: str | None = None,
):
    """Add a matched pair to the comparison."""
    aci_t = aci_item.total_cost or (
        (aci_item.quantity or 1) * (aci_item.unit_cost or 0)
    )
    carrier_t = carrier_item.total_cost or (
        (carrier_item.quantity or 1) * (carrier_item.unit_cost or 0)
    )
    diff = (aci_t or 0) - (carrier_t or 0)

    # Determine status
    if aci_t and carrier_t and aci_t > 0:
        pct_diff = abs(diff) / aci_t * 100
        if pct_diff <= price_threshold:
            status = "match"
            result.match_count += 1
        else:
            status = "price_diff"
            result.price_diff_count += 1
            if diff > 0:
                result.supplement_total += diff
    else:
        status = "match"
        result.match_count += 1

    comp_room.items.append(ComparisonLineItem(
        room_name=comp_room.room_name,
        description=aci_item.description,
        aci_quantity=aci_item.quantity,
        aci_unit=aci_item.unit,
        aci_unit_cost=aci_item.unit_cost,
        aci_total=aci_t,
        carrier_quantity=carrier_item.quantity,
        carrier_unit=carrier_item.unit,
        carrier_unit_cost=carrier_item.unit_cost,
        carrier_total=carrier_t,
        difference=diff,
        status=status,
        category=aci_item.category,
        match_score=match_score,
        match_confidence=match_confidence,
    ))
