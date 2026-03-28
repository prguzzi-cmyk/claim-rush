#!/usr/bin/env python

"""Carrier estimate document parser — 2-layer engine.

Layer 1 (Xactimate):  pdfplumber table extraction + regex fallback — no AI needed.
Layer 2 (Generic):    Claude-powered extraction with enhanced prompt.
Paste path:           Always goes through Claude.

Both paths return a unified ``ParseResult`` with per-item confidence scoring.
"""

from __future__ import annotations

import io
import json
import logging
import re
from dataclasses import asdict, dataclass, field

import pdfplumber

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ParsedLineItem:
    description: str
    quantity: float
    unit: str | None
    unit_cost: float | None
    total_cost: float | None
    room_name: str | None
    category: str | None
    line_item_code: str | None  # Xactimate code e.g. "DRYWL"
    confidence: str  # "high" | "medium" | "low"


@dataclass
class ParseResult:
    items: list[ParsedLineItem]
    parser_type: str  # "xactimate" | "generic" | "paste"
    parse_confidence: str  # "high" | "medium" | "low"
    raw_text: str | None = None


# ── Constants ─────────────────────────────────────────────────────────────────

_XACTIMATE_CODE_RE = re.compile(r"^[A-Z]{2,6}\d*$")

_XACTIMATE_LINE_RE = re.compile(
    r"([A-Z]{2,6}\d*)\s+"           # line item code
    r"(.{10,60}?)\s+"               # description
    r"([\d,.]+)\s+"                  # quantity
    r"(SF|LF|SY|EA|HR|CF|GAL)\s+"   # unit
    r"\$?([\d,.]+)\s+"              # unit cost
    r"\$?([\d,.]+)",                # total
    re.IGNORECASE,
)

_ROOM_HEADER_PATTERNS = [
    re.compile(r"^(?:Room|Area|Location):\s*(.+)", re.IGNORECASE),
    re.compile(r"^(\d+)\.\s+([A-Z][a-zA-Z ]+)$"),
    re.compile(r"^---\s*(.+?)\s*---$"),
    re.compile(
        r"^(Kitchen|Bathroom|Bedroom|Living\s*Room|Dining\s*Room|Garage|"
        r"Basement|Attic|Hallway|Exterior|Master|Family\s*Room|Laundry|"
        r"Entry|Foyer|Office|Den|Closet|Porch|Patio|Deck)\b",
        re.IGNORECASE,
    ),
]

_TABLE_HEADER_KEYWORDS = {
    "description", "desc", "item", "work",
    "qty", "quantity",
    "unit",
    "unit price", "unit cost", "price",
    "total", "amount", "ext", "extension",
}

# ── Public API ────────────────────────────────────────────────────────────────

def parse_carrier_estimate(
    file_bytes: bytes | None = None,
    pasted_text: str | None = None,
    file_type: str = "pdf",
    room_names: list[str] | None = None,
) -> ParseResult:
    """Parse a carrier estimate from PDF bytes or pasted text.

    Returns a ``ParseResult`` with items, parser_type, and parse_confidence.
    """
    # ── Paste path ────────────────────────────────────────────────────
    if pasted_text:
        return _parse_paste(pasted_text, room_names)

    # ── File path ─────────────────────────────────────────────────────
    if not file_bytes:
        return ParseResult(items=[], parser_type="generic", parse_confidence="low")

    if file_type != "pdf":
        # Non-PDF files: extract as text and use generic path
        text = file_bytes.decode("utf-8", errors="replace")
        if not text or len(text.strip()) < 20:
            return ParseResult(items=[], parser_type="generic", parse_confidence="low")
        items = _parse_generic_with_claude(text, room_names)
        return ParseResult(
            items=items,
            parser_type="generic",
            parse_confidence=_compute_overall_confidence(items),
            raw_text=text[:5000],
        )

    # ── PDF path ──────────────────────────────────────────────────────
    text, tables = _extract_pdf_text_and_tables(file_bytes)

    if not text or len(text.strip()) < 20:
        return ParseResult(items=[], parser_type="generic", parse_confidence="low")

    fmt = _detect_format(text, tables)

    if fmt == "xactimate":
        items = _parse_xactimate(text, tables, room_names)
        return ParseResult(
            items=items,
            parser_type="xactimate",
            parse_confidence=_compute_overall_confidence(items),
            raw_text=text[:5000],
        )

    # Generic path
    items = _parse_generic_with_claude(text, room_names)
    if not items:
        logger.info("Claude returned no items, falling back to regex parser")
        items = _parse_with_regex(text)
    return ParseResult(
        items=items,
        parser_type="generic",
        parse_confidence=_compute_overall_confidence(items),
        raw_text=text[:5000],
    )


# ── PDF extraction ────────────────────────────────────────────────────────────

def _extract_pdf_text_and_tables(
    file_bytes: bytes,
) -> tuple[str, list[list[list[str | None]]]]:
    """Extract full text AND tables from a PDF."""
    all_text_parts: list[str] = []
    all_tables: list[list[list[str | None]]] = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            all_text_parts.append(page_text)
            try:
                page_tables = page.extract_tables() or []
                all_tables.extend(page_tables)
            except Exception:
                pass

    return "\n".join(all_text_parts), all_tables


# ── Format detection ──────────────────────────────────────────────────────────

def _detect_format(text: str, tables: list) -> str:
    """Determine if the PDF is an Xactimate estimate or generic.

    Returns ``"xactimate"`` when 3+ Xactimate indicators are found.
    """
    score = 0
    upper = text.upper()

    # Indicator 1: Xactimate / XactNet branding
    if "XACTIMATE" in upper or "XACTNET" in upper:
        score += 1

    # Indicator 2: Verisk / Xactware branding
    if "VERISK" in upper or "XACTWARE" in upper:
        score += 1

    # Indicator 3: line item codes matching pattern
    code_matches = re.findall(r"\b[A-Z]{3,6}\d*\b", text)
    if len(code_matches) >= 5:
        score += 1

    # Indicator 4: structured table headers in sequence
    header_keywords = ["description", "qty", "unit", "price", "total"]
    found = sum(1 for kw in header_keywords if kw in text.lower())
    if found >= 4:
        score += 1

    # Indicator 5: RCV / ACV columns
    if "RCV" in upper and "ACV" in upper:
        score += 1

    # Indicator 6: O&P references
    if "O&P" in upper or "OVERHEAD & PROFIT" in upper or "OVERHEAD AND PROFIT" in upper:
        score += 1

    # Indicator 7: Room/area headers followed by indented items
    room_header_count = sum(
        1 for p in _ROOM_HEADER_PATTERNS for _ in p.finditer(text)
    )
    if room_header_count >= 2:
        score += 1

    return "xactimate" if score >= 3 else "generic"


# ── Xactimate parser ─────────────────────────────────────────────────────────

def _parse_xactimate(
    text: str,
    tables: list[list[list[str | None]]],
    room_names: list[str] | None,
) -> list[ParsedLineItem]:
    """Primary Xactimate parser: tables first, regex fallback."""
    items = _parse_xactimate_tables(tables, room_names)

    if not items:
        logger.info("No items from table extraction, trying Xactimate regex")
        items = _parse_xactimate_regex(text, room_names)

    return items


def _parse_xactimate_tables(
    tables: list[list[list[str | None]]],
    room_names: list[str] | None,
) -> list[ParsedLineItem]:
    """Extract line items from pdfplumber-extracted tables."""
    items: list[ParsedLineItem] = []

    for table in tables:
        if not table or len(table) < 2:
            continue

        col_map = _identify_columns(table[0])
        if not col_map:
            # Try second row as header
            if len(table) >= 3:
                col_map = _identify_columns(table[1])
                data_rows = table[2:]
            else:
                continue
        else:
            data_rows = table[1:]

        current_room = "General"

        for row in data_rows:
            if not row or all(not cell for cell in row):
                continue

            # Detect room header row (spans full width or has room prefix)
            room = _detect_room_from_row(row)
            if room:
                current_room = room
                continue

            item = _extract_item_from_row(row, col_map, current_room)
            if item:
                items.append(item)

    return items


def _identify_columns(header_row: list[str | None]) -> dict[str, int] | None:
    """Map column names to indices from a header row."""
    if not header_row:
        return None

    col_map: dict[str, int] = {}
    for idx, cell in enumerate(header_row):
        if not cell:
            continue
        cell_lower = cell.strip().lower()

        if any(kw in cell_lower for kw in ("desc", "item", "work")):
            col_map["description"] = idx
        elif cell_lower in ("qty", "quantity"):
            col_map["quantity"] = idx
        elif cell_lower == "unit" or cell_lower == "uom":
            col_map["unit"] = idx
        elif any(kw in cell_lower for kw in ("unit price", "unit cost", "rate")):
            col_map["unit_cost"] = idx
        elif cell_lower in ("total", "amount", "ext", "extension", "line total"):
            col_map["total"] = idx
        elif cell_lower == "price" and "unit_cost" not in col_map:
            col_map["unit_cost"] = idx
        elif cell_lower in ("code", "item code", "line code"):
            col_map["code"] = idx

    # Need at least description and one numeric column
    if "description" not in col_map:
        return None
    if not (col_map.get("quantity") or col_map.get("total") or col_map.get("unit_cost")):
        return None

    return col_map


def _detect_room_from_row(row: list[str | None]) -> str | None:
    """Check if a table row is a room/area header."""
    # Room headers often span the full row (only first cell populated)
    non_empty = [c for c in row if c and c.strip()]
    if len(non_empty) == 1:
        text = non_empty[0].strip()
        for pattern in _ROOM_HEADER_PATTERNS:
            m = pattern.match(text)
            if m:
                return m.group(1).strip().title() if m.lastindex else text.title()
        # Short text that looks like a room name
        if len(text) < 40 and not any(c.isdigit() for c in text):
            return text.title()
    return None


def _extract_item_from_row(
    row: list[str | None],
    col_map: dict[str, int],
    current_room: str,
) -> ParsedLineItem | None:
    """Convert a table data row to a ParsedLineItem."""

    def _get(key: str) -> str | None:
        idx = col_map.get(key)
        if idx is None or idx >= len(row):
            return None
        return (row[idx] or "").strip() or None

    desc = _get("description")
    if not desc or len(desc) < 3:
        return None

    # Extract line item code from code column or description prefix
    code = _get("code")
    if not code:
        code_match = re.match(r"^([A-Z]{2,6}\d*)\s+", desc)
        if code_match:
            code = code_match.group(1)
            desc = desc[code_match.end():].strip()

    qty = _parse_number(_get("quantity")) or 1.0
    unit = _get("unit")
    unit_cost = _parse_number(_get("unit_cost"))
    total = _parse_number(_get("total"))

    # Compute missing total
    if not total and unit_cost:
        total = qty * unit_cost
    elif total and not unit_cost and qty:
        unit_cost = total / qty

    return ParsedLineItem(
        description=desc,
        quantity=qty,
        unit=unit,
        unit_cost=unit_cost,
        total_cost=total,
        room_name=current_room,
        category=_infer_category(desc),
        line_item_code=code,
        confidence="high",  # structured table data
    )


def _parse_xactimate_regex(
    text: str,
    room_names: list[str] | None,
) -> list[ParsedLineItem]:
    """Fallback regex parser tuned for Xactimate text layout."""
    items: list[ParsedLineItem] = []
    current_room = "General"

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Check for room headers
        room = _detect_room_from_text_line(line)
        if room:
            current_room = room
            continue

        m = _XACTIMATE_LINE_RE.match(line)
        if m:
            code = m.group(1)
            desc = m.group(2).strip()
            qty = _parse_number(m.group(3)) or 1.0
            unit = m.group(4).strip().upper()
            unit_cost = _parse_number(m.group(5))
            total = _parse_number(m.group(6))

            items.append(ParsedLineItem(
                description=desc,
                quantity=qty,
                unit=unit,
                unit_cost=unit_cost,
                total_cost=total,
                room_name=current_room,
                category=_infer_category(desc),
                line_item_code=code,
                confidence="medium",  # regex-parsed
            ))

    return items


# ── Generic parser (Claude) ───────────────────────────────────────────────────

def _parse_generic_with_claude(
    text: str,
    room_names: list[str] | None,
) -> list[ParsedLineItem]:
    """Enhanced Claude prompt for generic (non-Xactimate) carrier estimates."""
    import anthropic

    room_hint = ""
    if room_names:
        room_hint = (
            f"\n\nThe ACI estimate has these rooms: {', '.join(room_names)}. "
            "Try to assign each line item to the most appropriate room_name from this list. "
            "If no room matches, use the room name from the carrier document."
        )

    system_prompt = (
        "You are parsing an insurance carrier estimate document. "
        "This is NOT an Xactimate estimate.\n\n"
        "Extract EVERY line item. For each, provide:\n"
        '- "description": work description\n'
        '- "quantity": numeric (default 1.0)\n'
        '- "unit": SF/LF/SY/EA/HR/etc (infer if possible)\n'
        '- "unit_cost": per-unit dollar amount\n'
        '- "total_cost": total dollar amount\n'
        '- "room_name": which room/area\n'
        '- "category": one of: walls, ceiling, floor, trim, doors, windows, '
        'cabinets, fixtures, misc_items\n'
        '- "line_item_code": null (generic format)\n'
        '- "confidence": "high" if values are clearly readable, '
        '"medium" if inferred, "low" if uncertain\n\n'
        "Return ONLY valid JSON array. No markdown, no explanation."
        + room_hint
    )

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=8192,
            system=system_prompt,
            messages=[
                {"role": "user", "content": text[:30000]},
            ],
        )
        raw = response.content[0].text
        json_match = re.search(r"\[.*\]", raw, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            return _dicts_to_parsed_items(parsed, default_confidence="medium")
        return []
    except Exception as e:
        logger.error(f"Claude carrier parsing error: {e}")
        return []


# ── Paste parser ──────────────────────────────────────────────────────────────

def _parse_paste(
    text: str,
    room_names: list[str] | None,
) -> ParseResult:
    """Parse pasted carrier estimate text via Claude."""
    if not text or len(text.strip()) < 20:
        return ParseResult(items=[], parser_type="paste", parse_confidence="low")

    items = _parse_generic_with_claude(text, room_names)
    return ParseResult(
        items=items,
        parser_type="paste",
        parse_confidence=_compute_overall_confidence(items),
        raw_text=text[:5000],
    )


# ── Legacy regex fallback ────────────────────────────────────────────────────

def _parse_with_regex(text: str) -> list[ParsedLineItem]:
    """Fallback regex-based parser for when Claude is unavailable."""
    items: list[ParsedLineItem] = []
    pattern = re.compile(
        r"^(.{10,60}?)\s+"
        r"([\d,.]+)\s+"
        r"(SF|LF|SY|EA|HR|CF|GAL|Each|Sq\.?\s*Ft\.?)\s+"
        r"\$?([\d,.]+)\s+"
        r"\$?([\d,.]+)\s*$",
        re.MULTILINE | re.IGNORECASE,
    )

    current_room = "General"
    room_pattern = re.compile(
        r"^(Kitchen|Bathroom|Bedroom|Living\s*Room|Dining\s*Room|Garage|"
        r"Basement|Attic|Hallway|Exterior|Master|Family\s*Room|Laundry|"
        r"Entry|Foyer|Office|Den|Closet|Porch|Patio|Deck)\b",
        re.IGNORECASE | re.MULTILINE,
    )

    for line in text.split("\n"):
        line = line.strip()
        room_match = room_pattern.match(line)
        if room_match and len(line) < 40:
            current_room = room_match.group(1).strip().title()
            continue

        match = pattern.match(line)
        if match:
            desc = match.group(1).strip()
            qty = _parse_number(match.group(2)) or 1.0
            unit = match.group(3).strip().upper()
            uc = _parse_number(match.group(4))
            total = _parse_number(match.group(5))

            if unit in ("EACH", "EA."):
                unit = "EA"
            elif "SQ" in unit or "FT" in unit:
                unit = "SF"

            items.append(ParsedLineItem(
                description=desc,
                quantity=qty,
                unit=unit,
                unit_cost=uc,
                total_cost=total,
                room_name=current_room,
                category="misc_items",
                line_item_code=None,
                confidence="low",  # regex fallback
            ))

    return items


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_number(s: str | None) -> float | None:
    """Safely parse a numeric string, stripping $ and commas."""
    if not s:
        return None
    s = s.strip().replace(",", "").replace("$", "")
    try:
        return float(s)
    except ValueError:
        return None


def _detect_room_from_text_line(line: str) -> str | None:
    """Check if a text line is a room header."""
    if len(line) > 60:
        return None
    for pattern in _ROOM_HEADER_PATTERNS:
        m = pattern.match(line)
        if m:
            return m.group(1).strip().title() if m.lastindex else line.strip().title()
    return None


def _infer_category(description: str) -> str:
    """Infer category from description text."""
    desc_lower = description.lower()
    if any(kw in desc_lower for kw in ("drywall", "sheetrock", "wall", "stucco")):
        return "walls"
    if any(kw in desc_lower for kw in ("ceiling", "popcorn", "texture")):
        return "ceiling"
    if any(kw in desc_lower for kw in ("floor", "carpet", "tile", "vinyl", "laminate", "hardwood")):
        return "floor"
    if any(kw in desc_lower for kw in ("trim", "baseboard", "crown", "casing", "molding")):
        return "trim"
    if any(kw in desc_lower for kw in ("door", "entry")):
        return "doors"
    if any(kw in desc_lower for kw in ("window", "glass", "pane")):
        return "windows"
    if any(kw in desc_lower for kw in ("cabinet", "vanity", "countertop")):
        return "cabinets"
    if any(kw in desc_lower for kw in ("fixture", "faucet", "light", "outlet", "switch", "toilet", "sink")):
        return "fixtures"
    if any(kw in desc_lower for kw in ("paint", "primer", "stain")):
        return "walls"  # painting is usually walls
    return "misc_items"


def _dicts_to_parsed_items(
    dicts: list[dict],
    default_confidence: str = "medium",
) -> list[ParsedLineItem]:
    """Convert a list of dicts (from Claude JSON) to ParsedLineItem objects."""
    items: list[ParsedLineItem] = []
    for d in dicts:
        try:
            items.append(ParsedLineItem(
                description=d.get("description", ""),
                quantity=float(d.get("quantity", 1.0) or 1.0),
                unit=d.get("unit"),
                unit_cost=_safe_float(d.get("unit_cost")),
                total_cost=_safe_float(d.get("total_cost")),
                room_name=d.get("room_name"),
                category=d.get("category", "misc_items"),
                line_item_code=d.get("line_item_code"),
                confidence=d.get("confidence", default_confidence),
            ))
        except (ValueError, TypeError):
            continue
    return items


def _safe_float(val) -> float | None:
    """Convert value to float or None."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _compute_overall_confidence(items: list[ParsedLineItem]) -> str:
    """Compute overall confidence from individual item confidences."""
    if not items:
        return "low"
    high = sum(1 for i in items if i.confidence == "high")
    ratio = high / len(items)
    if ratio >= 0.8:
        return "high"
    elif ratio >= 0.4:
        return "medium"
    return "low"
