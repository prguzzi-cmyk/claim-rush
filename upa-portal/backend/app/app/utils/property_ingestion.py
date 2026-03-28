#!/usr/bin/env python

"""Property discovery via OSM building footprints with grid-scan fallback."""

import hashlib
import math

import httpx

from app.core.log import logger

# Overpass API endpoint (public, rate-limited)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 30  # seconds

# Grid scan spacing in meters (typical residential lot)
GRID_SPACING_M = 150


def discover_properties_in_zone(
    center_lat: float,
    center_lng: float,
    radius_meters: float,
    max_properties: int = 200,
) -> list[dict]:
    """Try OSM first, fall back to grid scan if too few results."""
    props = fetch_osm_buildings(center_lat, center_lng, radius_meters, max_properties)

    if len(props) < 10:
        grid_count = max_properties - len(props)
        props += generate_grid_scan(center_lat, center_lng, radius_meters, grid_count)

    return props[:max_properties]


def fetch_osm_buildings(
    lat: float, lng: float, radius_m: float, limit: int
) -> list[dict]:
    """Query OSM Overpass API for building footprints in a bounding box.

    Returns list of property dicts ready for roof_scan_queue insertion.
    """
    south, west, north, east = _bbox_from_center(lat, lng, radius_m)

    query = f"""
    [out:json][timeout:{OVERPASS_TIMEOUT}];
    way["building"]({south},{west},{north},{east});
    out center body {limit};
    """

    try:
        with httpx.Client(timeout=OVERPASS_TIMEOUT + 5) as client:
            resp = client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Overpass API request failed: %s", exc)
        return []

    elements = data.get("elements", [])
    properties: list[dict] = []

    for el in elements:
        osm_id = el.get("id")
        center = el.get("center", {})
        el_lat = center.get("lat") or el.get("lat")
        el_lng = center.get("lon") or el.get("lon")

        if not el_lat or not el_lng:
            continue

        tags = el.get("tags", {})
        building_type = tags.get("building", "yes")
        if building_type == "yes":
            building_type = "residential"

        # Estimate building area from bounding geometry (rough)
        area_sqft = _estimate_area_sqft(el)

        # Build address from OSM tags
        addr_parts = []
        if tags.get("addr:housenumber"):
            addr_parts.append(tags["addr:housenumber"])
        if tags.get("addr:street"):
            addr_parts.append(tags["addr:street"])
        if tags.get("addr:city"):
            addr_parts.append(tags["addr:city"])
        address = " ".join(addr_parts) if addr_parts else f"Near {el_lat:.5f}, {el_lng:.5f}"

        properties.append({
            "property_id": f"osm-{osm_id}",
            "latitude": float(el_lat),
            "longitude": float(el_lng),
            "address": address,
            "building_type": building_type,
            "building_area_sqft": area_sqft,
            "source": "osm",
        })

    logger.info(
        "OSM discovery: found %d buildings within %.0fm of (%.4f, %.4f)",
        len(properties), radius_m, lat, lng,
    )
    return properties


def generate_grid_scan(
    lat: float, lng: float, radius_m: float, count: int
) -> list[dict]:
    """Generate evenly-spaced grid points within a circle as scan targets."""
    if count <= 0:
        return []

    # Calculate grid dimensions
    spacing_deg_lat = GRID_SPACING_M / 111_320.0
    spacing_deg_lng = GRID_SPACING_M / (111_320.0 * math.cos(math.radians(lat)))

    radius_deg_lat = radius_m / 111_320.0
    radius_deg_lng = radius_m / (111_320.0 * math.cos(math.radians(lat)))

    properties: list[dict] = []

    # Generate grid from -radius to +radius, filter to circle
    curr_lat = lat - radius_deg_lat
    while curr_lat <= lat + radius_deg_lat and len(properties) < count:
        curr_lng = lng - radius_deg_lng
        while curr_lng <= lng + radius_deg_lng and len(properties) < count:
            # Check if point is within the circle
            dlat = (curr_lat - lat) * 111_320.0
            dlng = (curr_lng - lng) * 111_320.0 * math.cos(math.radians(lat))
            dist = math.sqrt(dlat**2 + dlng**2)

            if dist <= radius_m:
                point_hash = hashlib.md5(
                    f"{curr_lat:.6f},{curr_lng:.6f}".encode()
                ).hexdigest()[:12]

                properties.append({
                    "property_id": f"grid-{point_hash}",
                    "latitude": round(curr_lat, 6),
                    "longitude": round(curr_lng, 6),
                    "address": f"Grid scan point near {curr_lat:.5f}, {curr_lng:.5f}",
                    "building_type": None,
                    "building_area_sqft": None,
                    "source": "grid_scan",
                })

            curr_lng += spacing_deg_lng
        curr_lat += spacing_deg_lat

    logger.info(
        "Grid scan: generated %d points within %.0fm of (%.4f, %.4f)",
        len(properties), radius_m, lat, lng,
    )
    return properties


def _bbox_from_center(
    lat: float, lng: float, radius_m: float
) -> tuple[float, float, float, float]:
    """Geodesic bounding box: (south, west, north, east)."""
    lat_offset = radius_m / 111_320.0
    lng_offset = radius_m / (111_320.0 * math.cos(math.radians(lat)))
    return (
        lat - lat_offset,
        lng - lng_offset,
        lat + lat_offset,
        lng + lng_offset,
    )


def _estimate_area_sqft(element: dict) -> float | None:
    """Rough area estimate from OSM way nodes (if available)."""
    # If the element has bounds, estimate from bounding box
    bounds = element.get("bounds", {})
    if bounds:
        min_lat = bounds.get("minlat", 0)
        max_lat = bounds.get("maxlat", 0)
        min_lon = bounds.get("minlon", 0)
        max_lon = bounds.get("maxlon", 0)

        width_m = abs(max_lon - min_lon) * 111_320.0 * math.cos(math.radians((min_lat + max_lat) / 2))
        height_m = abs(max_lat - min_lat) * 111_320.0
        area_sqm = width_m * height_m

        if area_sqm > 0:
            return round(area_sqm * 10.764, 1)  # sqm to sqft

    return None
