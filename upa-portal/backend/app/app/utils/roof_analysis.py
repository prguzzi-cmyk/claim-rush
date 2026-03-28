"""AI-powered roof damage analysis using satellite imagery + OpenAI Vision.

Supports multiple analysis modes:
  - ai_vision: OpenAI Vision API analysis
  - rules: Deterministic rules engine scoring
  - demo: Rules engine with demo flag
  - auto: Try AI first, fall back to rules
"""

import base64
import hashlib
import json
import logging
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from app.core.config import settings
from app.utils.satellite_imagery import fetch_roof_image
from app.utils.roof_rules_engine import score_property

logger = logging.getLogger(__name__)

# Damage-label thresholds for the deterministic fallback
_LABEL_THRESHOLDS = [
    (80, "severe"),
    (60, "high"),
    (40, "moderate"),
    (20, "low"),
    (0, "none"),
]


def _score_to_label(score: int) -> str:
    for threshold, label in _LABEL_THRESHOLDS:
        if score >= threshold:
            return label
    return "none"


def _get_media_dir() -> Path:
    """Resolve the media directory — Docker (/app/media/) or local fallback."""
    docker_path = Path("/app/media/roof-analysis")
    if docker_path.parent.exists():
        docker_path.mkdir(parents=True, exist_ok=True)
        return docker_path
    local_path = Path("media/roof-analysis")
    local_path.mkdir(parents=True, exist_ok=True)
    return local_path


def _openai_configured() -> bool:
    key = getattr(settings, "AI_ESTIMATE_OPENAI_KEY", None)
    if not key or not key.strip():
        return False
    low = key.lower().strip()
    # Reject common placeholder / dummy values
    if any(tok in low for tok in ("need-to-change", "placeholder", "sk-local", "changeme", "xxx")):
        return False
    # Must look like a real OpenAI key
    if not low.startswith("sk-"):
        return False
    return len(key.strip()) >= 20


def analyze_single_roof(
    property_id: str,
    lat: float,
    lng: float,
    analysis_mode: str = "auto",
    storm_context: dict | None = None,
    roof_metadata: dict | None = None,
) -> dict:
    """
    Full analysis pipeline for one property.

    Parameters
    ----------
    property_id : str
        Unique property identifier
    lat, lng : float
        Property coordinates
    analysis_mode : str
        "ai_vision", "rules", "demo", or "auto"
    storm_context : dict | None
        Optional storm data: storm_type, storm_severity, hail_size_inches, wind_speed_mph
    roof_metadata : dict | None
        Optional roof data: roof_type, roof_age_years, roof_size_sqft

    Returns
    -------
    dict
        Analysis results with damage_score, damage_label, confidence, summary,
        indicators, image_path, image_source, analysis_mode, claim estimates, etc.
    """
    storm = storm_context or {}
    roof = roof_metadata or {}

    result = {
        "property_id": property_id,
        "damage_score": 0,
        "damage_label": "none",
        "confidence": "low",
        "summary": "",
        "indicators": [],
        "image_path": None,
        "image_source": None,
        "analysis_mode": analysis_mode,
        "claim_range_low": None,
        "claim_range_high": None,
        "estimated_claim_value": None,
        "recommended_action": None,
        "error": None,
    }

    # Demo mode — just run rules engine, no imagery
    if analysis_mode == "demo":
        rules_result = score_property(
            storm_type=storm.get("storm_type"),
            storm_severity=storm.get("storm_severity"),
            hail_size_inches=storm.get("hail_size_inches"),
            wind_speed_mph=storm.get("wind_speed_mph"),
            roof_age_years=roof.get("roof_age_years"),
            roof_type=roof.get("roof_type"),
            roof_size_sqft=roof.get("roof_size_sqft"),
            latitude=lat,
            longitude=lng,
        )
        result.update(rules_result)
        result["analysis_mode"] = "demo"
        return result

    # Fetch satellite image (cascade: Mapbox → Sentinel-2 → ESRI → Google → OAM → USGS)
    try:
        img, source = fetch_roof_image(lat, lng)
        result["image_source"] = source
    except Exception as exc:
        logger.error("Image fetch failed for %s: %s", property_id, exc)
        result["error"] = f"Image fetch failed: {exc}"
        result["summary"] = "Could not retrieve satellite imagery."
        # Fall through to rules engine
        img, source = None, "none"

    if img is None and analysis_mode == "ai_vision":
        result["error"] = "No image returned — cannot run AI vision"
        result["summary"] = "Satellite imagery unavailable for this location."
        # Fall back to rules
        analysis_mode = "rules"

    # Record scan timestamp when image is fetched
    if img is not None:
        result["scan_timestamp"] = datetime.now(timezone.utc).isoformat()

    # Save image to disk if available
    if img is not None:
        media_dir = _get_media_dir()
        filename = f"{property_id}.jpg"
        filepath = media_dir / filename
        try:
            img.save(str(filepath), "JPEG", quality=85)
            result["image_path"] = str(filepath)
        except Exception as exc:
            logger.warning("Could not save image for %s: %s", property_id, exc)

    # AI Vision analysis
    if analysis_mode in ("ai_vision", "auto") and img is not None and _openai_configured():
        try:
            result = _analyze_with_openai(result, img)
            result["analysis_mode"] = "ai_vision"
            # Use AI-detected roof sqft if available for more accurate claims
            ai_sqft = result.get("estimated_roof_sqft")
            if ai_sqft and ai_sqft > 0:
                roof["roof_size_sqft"] = ai_sqft
            # Calculate claim estimates using AI damage score + best sqft
            rules_result = score_property(
                storm_type=storm.get("storm_type"),
                storm_severity=storm.get("storm_severity"),
                hail_size_inches=storm.get("hail_size_inches"),
                wind_speed_mph=storm.get("wind_speed_mph"),
                roof_age_years=roof.get("roof_age_years"),
                roof_type=roof.get("roof_type"),
                roof_size_sqft=roof.get("roof_size_sqft"),
                latitude=lat,
                longitude=lng,
            )
            result["claim_range_low"] = rules_result["claim_range_low"]
            result["claim_range_high"] = rules_result["claim_range_high"]
            result["estimated_claim_value"] = rules_result["estimated_claim_value"]
            result["recommended_action"] = rules_result["recommended_action"]
            return result
        except Exception as exc:
            logger.warning(
                "OpenAI analysis failed for %s, falling back to rules: %s",
                property_id, exc,
            )
            result["error"] = f"AI analysis failed: {exc}"

    # Rules engine scoring (fallback or primary)
    logger.info("Using rules engine for %s", property_id)
    rules_result = score_property(
        storm_type=storm.get("storm_type"),
        storm_severity=storm.get("storm_severity"),
        hail_size_inches=storm.get("hail_size_inches"),
        wind_speed_mph=storm.get("wind_speed_mph"),
        roof_age_years=roof.get("roof_age_years"),
        roof_type=roof.get("roof_type"),
        roof_size_sqft=roof.get("roof_size_sqft"),
        latitude=lat,
        longitude=lng,
    )
    result.update(rules_result)
    result["analysis_mode"] = "rules"
    result["error"] = None  # rules engine succeeded
    return result


def _analyze_with_openai(result: dict, img) -> dict:
    """Send image to OpenAI Vision and parse the JSON response."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.AI_ESTIMATE_OPENAI_KEY)

    # Base64-encode the image
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    data_url = f"data:image/jpeg;base64,{b64}"

    system_prompt = (
        "You are an expert roof damage analyst for property insurance claims. "
        "Analyze the satellite/aerial image and assess roof damage. "
        "Respond with ONLY valid JSON — no markdown fences, no extra text.\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "damage_score": <0-100>,\n'
        '  "damage_label": "<none|low|moderate|high|severe>",\n'
        '  "confidence": "<low|medium|high>",\n'
        '  "summary": "<1-2 sentence summary>",\n'
        '  "indicators": [\n'
        "    {\n"
        '      "type": "<indicator_type>",\n'
        '      "detected": <true|false>,\n'
        '      "confidence": <0.0-1.0>,\n'
        '      "severity": "<none|minor|moderate|severe>",\n'
        '      "area_affected_pct": <0-100>,\n'
        '      "notes": "<brief observation>"\n'
        "    }\n"
        "  ],\n"
        '  "roof_condition": "<good|fair|poor|critical>",\n'
        '  "estimated_roof_sqft": <number or null>,\n'
        '  "damage_area_sqft": <number or null>\n'
        "}\n\n"
        "Indicator types to evaluate (report ALL, even if not detected):\n"
        "- hail_strikes: Circular impact marks, dents, or dimpled patterns on shingles\n"
        "- missing_shingles: Exposed underlayment, bare patches, or absent shingle sections\n"
        "- roof_discoloration: Unusual color variations, algae/moss, water staining, granule loss\n"
        "- debris_fields: Tree limbs, branches, or foreign objects on roof surface\n"
        "- tarp_presence: Blue tarps, plastic sheeting, or temporary weather barriers\n"
        "- structural_impact: Sagging ridgelines, collapsed sections, deformed framing\n\n"
        "Rules:\n"
        "- 0 = no visible damage, 100 = total destruction\n"
        "- If the image is unclear, over water, or empty land: score=0, label=none, confidence=low, "
        "all indicators detected=false\n"
        "- Report ALL 6 indicator types with detected=false if not observed\n"
        "- estimated_roof_sqft: estimate visible roof area; null if cannot determine\n"
        "- damage_area_sqft: estimate damaged area; null if no damage\n"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Analyze this satellite image for roof damage."},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    response = client.chat.completions.create(
        model=settings.AI_ESTIMATE_OPENAI_MODEL,
        messages=messages,
        max_tokens=1024,
        temperature=0.3,
        top_p=0.1,
    )

    raw = response.choices[0].message.content or ""

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    parsed = json.loads(cleaned)

    result["damage_score"] = max(0, min(100, int(parsed.get("damage_score", 0))))
    result["damage_label"] = parsed.get("damage_label", "none")
    result["confidence"] = parsed.get("confidence", "low")
    result["summary"] = parsed.get("summary", "")
    result["roof_condition"] = parsed.get("roof_condition")
    result["estimated_roof_sqft"] = parsed.get("estimated_roof_sqft")
    result["damage_area_sqft"] = parsed.get("damage_area_sqft")

    # Parse structured indicators — convert dicts to summary strings for DB storage
    # but keep full objects in result for downstream consumers
    raw_indicators = parsed.get("indicators", [])
    if raw_indicators and isinstance(raw_indicators[0], dict):
        result["indicators_detail"] = raw_indicators
        # Flatten to string list for legacy indicators column
        result["indicators"] = [
            f"{ind['type']}: {ind['severity']} ({int(ind.get('confidence', 0) * 100)}% conf, "
            f"{ind.get('area_affected_pct', 0)}% area) — {ind.get('notes', '')}"
            for ind in raw_indicators
            if ind.get("detected", False)
        ]
    else:
        result["indicators"] = raw_indicators
        result["indicators_detail"] = []

    result["error"] = None

    return result
