"""Fetch real property/building data from OpenStreetMap (Overpass API)
with TIGER road-centerline fallback and Nominatim reverse-geocode fallback.

Drop-in replacement for mock_properties.generate_mock_properties().
"""

import logging
import math
import random
import time
import uuid
from typing import Any

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# State / city fallback (reused from mock_properties)
# ---------------------------------------------------------------------------
STATE_CITY_MAP: dict[str, list[str]] = {
    "TX": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
    "FL": ["Miami", "Orlando", "Tampa", "Jacksonville", "Naples"],
    "OK": ["Oklahoma City", "Tulsa", "Norman", "Edmond", "Broken Arrow"],
    "KS": ["Wichita", "Topeka", "Overland Park", "Lawrence", "Olathe"],
    "NE": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
    "CO": ["Denver", "Colorado Springs", "Aurora", "Boulder", "Pueblo"],
    "MO": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Jefferson City"],
    "AL": ["Birmingham", "Huntsville", "Mobile", "Montgomery", "Tuscaloosa"],
    "GA": ["Atlanta", "Savannah", "Augusta", "Macon", "Columbus"],
    "NC": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Wilmington"],
    "SC": ["Charleston", "Columbia", "Greenville", "Myrtle Beach", "Spartanburg"],
    "LA": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
    "MS": ["Jackson", "Biloxi", "Hattiesburg", "Meridian", "Tupelo"],
    "AR": ["Little Rock", "Fayetteville", "Fort Smith", "Jonesboro", "Pine Bluff"],
    "TN": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"],
    "IL": ["Chicago", "Springfield", "Peoria", "Rockford", "Naperville"],
    "IN": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
    "OH": ["Columbus", "Cleveland", "Cincinnati", "Dayton", "Toledo"],
    "PA": ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown", "Erie"],
    "NY": ["New York", "Buffalo", "Rochester", "Syracuse", "Albany"],
}
DEFAULT_STATE = "TX"
DEFAULT_CITIES = ["Springfield", "Riverside", "Fairview", "Georgetown", "Greenville"]

# ---------------------------------------------------------------------------
# Building-tag → property_type mapping
# ---------------------------------------------------------------------------
_BUILDING_TYPE_MAP: dict[str, str] = {
    "apartments": "Multi-Family",
    "residential": "Single Family",
    "house": "Single Family",
    "detached": "Single Family",
    "semidetached_house": "Duplex",
    "terrace": "Townhouse",
    "dormitory": "Multi-Family",
    "duplex": "Duplex",
    "bungalow": "Single Family",
    "static_caravan": "Mobile Home",
    "cabin": "Single Family",
    "farm": "Single Family",
}

# ---------------------------------------------------------------------------
# Simple in-memory cache
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 600  # 10 minutes
_CACHE_MAX = 50

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
_NOMINATIM_HEADERS = {"User-Agent": "UPA-Portal/1.0"}
_MAX_PROPERTIES = 200
_MAX_NOMINATIM_CALLS = 20
_ROAD_MATCH_THRESHOLD = 0.005  # ~500 m in degrees

# Full state name → abbreviation
_STATE_ABBREV: dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}


def _normalize_state(state: str) -> str:
    """Convert full state name to 2-letter abbreviation; pass through if already short."""
    if len(state) <= 2:
        return state.upper()
    return _STATE_ABBREV.get(state.lower(), state)


# ===================================================================
# Public API (drop-in replacement)
# ===================================================================

def get_properties_in_radius(
    lat: float, lng: float, radius_miles: float
) -> list[dict]:
    """Return real properties within *radius_miles* of (*lat*, *lng*).

    Format is identical to the former ``generate_mock_properties()``.
    """
    # --- cache check ---
    cache_key = f"{round(lat, 2)}:{round(lng, 2)}:{round(radius_miles, 1)}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            logger.debug("OSM cache hit for %s", cache_key)
            return data

    # --- resolve the real city/state for the center point (single call) ---
    center_info = _reverse_geocode_nominatim(lat, lng)
    if center_info and center_info.get("city"):
        fallback_city = center_info["city"]
        fallback_state = _normalize_state(
            center_info.get("state") or _estimate_state(lat, lng)
        )
    else:
        fallback_state, fallback_city = _estimate_state_city(lat, lng)

    # --- compute bbox ---
    bbox = _bbox_from_radius(lat, lng, radius_miles)

    # --- primary: Overpass buildings ---
    buildings = _query_overpass_buildings(bbox)

    if buildings:
        roads = _query_overpass_roads(bbox)
        properties = _build_properties_from_buildings(
            buildings, roads, fallback_city, fallback_state,
        )
    else:
        # Overpass failed or area has no buildings → Nominatim grid fallback
        logger.warning("No buildings from Overpass; falling back to Nominatim grid")
        properties = _nominatim_grid_fallback(
            lat, lng, radius_miles, fallback_city, fallback_state,
        )

    # --- cap results ---
    if len(properties) > _MAX_PROPERTIES:
        properties = random.sample(properties, _MAX_PROPERTIES)

    # --- cache store ---
    if len(_cache) >= _CACHE_MAX:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]
    _cache[cache_key] = (now, properties)

    return properties


# ===================================================================
# Bounding-box helper
# ===================================================================

def _bbox_from_radius(
    lat: float, lng: float, radius_miles: float
) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) bounding box."""
    dlat = radius_miles / 69.0
    dlng = radius_miles / (69.0 * math.cos(math.radians(lat)))
    return (lat - dlat, lng - dlng, lat + dlat, lng + dlng)


# ===================================================================
# Overpass queries
# ===================================================================

def _query_overpass_buildings(
    bbox: tuple[float, float, float, float],
) -> list[dict]:
    """Query Overpass for buildings inside *bbox*."""
    south, west, north, east = bbox
    query = (
        f'[out:json][timeout:30];'
        f'('
        f'  way["building"]({south},{west},{north},{east});'
        f'  relation["building"]({south},{west},{north},{east});'
        f');'
        f'out center tags;'
    )
    try:
        resp = requests.get(
            OVERPASS_URL, params={"data": query}, timeout=30,
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception:
        logger.exception("Overpass buildings query failed")
        return []

    results: list[dict] = []
    for el in elements:
        center = el.get("center", {})
        el_lat = center.get("lat") or el.get("lat")
        el_lng = center.get("lon") or el.get("lon")
        if el_lat is None or el_lng is None:
            continue
        results.append({
            "osm_id": el.get("id"),
            "lat": el_lat,
            "lng": el_lng,
            "tags": el.get("tags", {}),
        })
    return results


def _query_overpass_roads(
    bbox: tuple[float, float, float, float],
) -> list[dict]:
    """Query Overpass for highway ways with TIGER tags inside *bbox*."""
    south, west, north, east = bbox
    query = (
        f'[out:json][timeout:20];'
        f'way["highway"]["tiger:name_base"]({south},{west},{north},{east});'
        f'out center tags;'
    )
    try:
        resp = requests.get(
            OVERPASS_URL, params={"data": query}, timeout=20,
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception:
        logger.exception("Overpass roads query failed")
        return []

    results: list[dict] = []
    for el in elements:
        center = el.get("center", {})
        tags = el.get("tags", {})
        el_lat = center.get("lat") or el.get("lat")
        el_lng = center.get("lon") or el.get("lon")
        if el_lat is None or el_lng is None:
            continue
        results.append({
            "lat": el_lat,
            "lng": el_lng,
            "name_base": tags.get("tiger:name_base", ""),
            "name_type": tags.get("tiger:name_type", ""),
            "zip_left": tags.get("tiger:zip_left", ""),
            "zip_right": tags.get("tiger:zip_right", ""),
            "cfcc": tags.get("tiger:cfcc", ""),
        })
    return results


# ===================================================================
# Address estimation helpers
# ===================================================================

def _estimate_address_from_road(
    building: dict, roads: list[dict]
) -> dict[str, str] | None:
    """Find nearest TIGER road and synthesize a plausible address."""
    if not roads:
        return None

    b_lat, b_lng = building["lat"], building["lng"]
    best_road = None
    best_dist = float("inf")

    for road in roads:
        d = math.hypot(road["lat"] - b_lat, road["lng"] - b_lng)
        if d < best_dist:
            best_dist = d
            best_road = road

    if best_road is None or best_dist > _ROAD_MATCH_THRESHOLD:
        return None

    street_name = best_road["name_base"]
    if best_road["name_type"]:
        street_name = f"{street_name} {best_road['name_type']}"

    # Generate a plausible house number from position along road
    house_num = 100 + int(abs(b_lat * 1000 + b_lng * 1000) % 9900)

    zip_code = best_road["zip_left"] or best_road["zip_right"] or ""

    return {
        "address": f"{house_num} {street_name}",
        "zip_code": zip_code,
    }


def _reverse_geocode_nominatim(lat: float, lng: float) -> dict[str, str] | None:
    """Reverse-geocode a single point via Nominatim (rate-limited)."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                "lat": lat,
                "lon": lng,
                "format": "json",
                "zoom": 18,
                "addressdetails": 1,
            },
            headers=_NOMINATIM_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.debug("Nominatim reverse geocode failed for %s,%s", lat, lng)
        return None

    addr = data.get("address", {})
    house_number = addr.get("house_number", "")
    road = addr.get("road", "")
    if not road:
        return None

    address = f"{house_number} {road}".strip() if house_number else road
    city = addr.get("city") or addr.get("town") or addr.get("village") or ""
    state_name = addr.get("state", "")
    postcode = addr.get("postcode", "")

    return {
        "address": address,
        "city": city,
        "state": state_name,
        "zip_code": postcode,
    }


def _classify_building(tags: dict[str, str]) -> str:
    """Map OSM building tag to property_type string."""
    btype = tags.get("building", "yes").lower()
    return _BUILDING_TYPE_MAP.get(btype, "Single Family")


def _estimate_state(lat: float, lng: float) -> str:
    """Very rough state estimation from lat/lng (same logic as mock_properties)."""
    if lat < 28 and lng > -82:
        return "FL"
    if lat < 34 and lng < -94:
        return "TX"
    if 31 <= lat < 34 and lng > -90:
        return "GA"
    if 34 <= lat < 37 and lng > -84:
        return "NC"
    if 31 <= lat < 34 and -94 <= lng < -90:
        return "LA"
    if 34 <= lat < 37 and lng < -95:
        return "OK"
    if 37 <= lat < 40 and lng < -95:
        return "KS"
    if 37 <= lat < 40 and lng > -90:
        return "OH"
    if 40 <= lat < 43 and lng > -80:
        return "PA"
    if lat >= 43 and lng > -80:
        return "NY"
    if 37 <= lat < 40 and -95 <= lng < -90:
        return "MO"
    if 34 <= lat < 37 and -95 <= lng < -90:
        return "AR"
    if 37 <= lat < 40 and -90 <= lng < -85:
        return "IL"
    if lat < 34 and -90 <= lng < -85:
        return "MS"
    if lat < 34 and -88 <= lng < -85:
        return "AL"
    if 34 <= lat < 37 and -84 <= lng < -80:
        return "SC"
    if 35 <= lat < 37 and -90 <= lng < -82:
        return "TN"
    if 38 <= lat < 42 and -87 <= lng < -84:
        return "IN"
    if 39 <= lat < 42 and -105 <= lng < -100:
        return "CO"
    if 40 <= lat < 43 and -100 <= lng < -95:
        return "NE"
    return DEFAULT_STATE


def _estimate_state_city(lat: float, lng: float) -> tuple[str, str]:
    """Return (state_abbrev, city) as a rough fallback."""
    state = _estimate_state(lat, lng)
    cities = STATE_CITY_MAP.get(state, DEFAULT_CITIES)
    return state, random.choice(cities)


# ===================================================================
# Core assembly
# ===================================================================

def _build_properties_from_buildings(
    buildings: list[dict],
    roads: list[dict],
    fallback_city: str,
    fallback_state: str,
) -> list[dict]:
    """Convert raw OSM building data into the standard property dicts."""
    properties: list[dict] = []
    nominatim_budget = _MAX_NOMINATIM_CALLS

    for bldg in buildings:
        tags = bldg["tags"]
        b_lat = round(bldg["lat"], 6)
        b_lng = round(bldg["lng"], 6)

        address: str = ""
        city: str = ""
        state: str = ""
        zip_code: str = ""

        # --- Strategy 1: OSM addr tags ---
        house_number = tags.get("addr:housenumber", "")
        street = tags.get("addr:street", "")
        if house_number and street:
            address = f"{house_number} {street}"
            city = tags.get("addr:city", "")
            state = tags.get("addr:state", "")
            zip_code = tags.get("addr:postcode", "")

        # --- Strategy 2: TIGER road interpolation ---
        if not address:
            road_result = _estimate_address_from_road(bldg, roads)
            if road_result:
                address = road_result["address"]
                zip_code = road_result.get("zip_code", "")

        # --- Strategy 3: Nominatim reverse geocode ---
        if not address and nominatim_budget > 0:
            nominatim_budget -= 1
            nom = _reverse_geocode_nominatim(b_lat, b_lng)
            if nom:
                address = nom.get("address", "")
                city = city or nom.get("city", "")
                state = state or nom.get("state", "")
                zip_code = zip_code or nom.get("zip_code", "")
            # Rate limit: 1 req/sec
            time.sleep(1)

        # Skip buildings we couldn't resolve an address for at all
        if not address:
            continue

        # Fill in missing city / state / zip and normalize state
        state = _normalize_state(state) if state else fallback_state
        if not city:
            city = fallback_city
        if not zip_code:
            zip_code = "00000"

        properties.append({
            "id": str(uuid.uuid4()),
            "address": address,
            "city": city.title() if city.islower() else city,
            "state": state,
            "zip_code": zip_code,
            "latitude": b_lat,
            "longitude": b_lng,
            "property_type": _classify_building(tags),
        })

    return properties


def _nominatim_grid_fallback(
    lat: float, lng: float, radius_miles: float,
    fallback_city: str, fallback_state: str,
) -> list[dict]:
    """When Overpass is unavailable, sample ~20 grid points via Nominatim."""
    properties: list[dict] = []
    grid_size = 5  # 5×4 = 20 points
    bbox = _bbox_from_radius(lat, lng, radius_miles)
    south, west, north, east = bbox

    lat_step = (north - south) / grid_size
    lng_step = (east - west) / (grid_size - 1)

    count = 0

    for i in range(grid_size):
        for j in range(grid_size - 1):
            if count >= _MAX_NOMINATIM_CALLS:
                break
            p_lat = south + lat_step * (i + 0.5)
            p_lng = west + lng_step * (j + 0.5)

            nom = _reverse_geocode_nominatim(p_lat, p_lng)
            count += 1
            time.sleep(1)  # rate limit

            if not nom or not nom.get("address"):
                continue

            properties.append({
                "id": str(uuid.uuid4()),
                "address": nom["address"],
                "city": nom.get("city") or fallback_city,
                "state": _normalize_state(nom["state"]) if nom.get("state") else fallback_state,
                "zip_code": nom.get("zip_code") or "00000",
                "latitude": round(p_lat, 6),
                "longitude": round(p_lng, 6),
                "property_type": "Single Family",
            })
        if count >= _MAX_NOMINATIM_CALLS:
            break

    return properties
