"""Fetch satellite roof imagery from multiple providers.

Cascade order: Mapbox → Sentinel-2 → ESRI → Google Static Maps → OAM → USGS NAIP.
"""

import logging
import math
from io import BytesIO

import requests
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

ESRI_TILE_URL = (
    "https://server.arcgisonline.com/ArcGIS/rest/services/"
    "World_Imagery/MapServer/tile/{z}/{y}/{x}"
)
TILE_SIZE = 256
DEFAULT_ZOOM = 19  # ~1.19 m/px

OAM_META_URL = "https://api.openaerialmap.org/meta"
USGS_NAIP_WMS_URL = (
    "https://imagery.nationalmap.gov/arcgis/services/"
    "USGSNAIPImagery/ImageServer/WMSServer"
)

MAPBOX_STATIC_URL = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static"
SENTINEL_TOKEN_URL = "https://services.sentinel-hub.com/oauth/token"
SENTINEL_WMS_URL = "https://services.sentinel-hub.com/ogc/wms"
GOOGLE_STATIC_URL = "https://maps.googleapis.com/maps/api/staticmap"


def lat_lng_to_tile(lat: float, lng: float, zoom: int) -> tuple[int, int]:
    """Convert lat/lng to tile x, y at the given zoom level."""
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    tile_x = int((lng + 180.0) / 360.0 * n)
    tile_y = int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return tile_x, tile_y


def lat_lng_to_pixel_in_tile(
    lat: float, lng: float, zoom: int
) -> tuple[int, int, int, int]:
    """Return (tile_x, tile_y, pixel_x_within_tile, pixel_y_within_tile)."""
    lat_rad = math.radians(lat)
    n = 2 ** zoom

    x_float = (lng + 180.0) / 360.0 * n
    y_float = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n

    tile_x = int(x_float)
    tile_y = int(y_float)
    px_x = int((x_float - tile_x) * TILE_SIZE)
    px_y = int((y_float - tile_y) * TILE_SIZE)

    return tile_x, tile_y, px_x, px_y


def fetch_tile(z: int, x: int, y: int) -> Image.Image | None:
    """Fetch a single ESRI tile. Returns a PIL Image or None on failure."""
    url = ESRI_TILE_URL.format(z=z, y=y, x=x)
    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "UPA-Portal/1.0"})
        resp.raise_for_status()
        return Image.open(BytesIO(resp.content)).convert("RGB")
    except Exception as exc:
        logger.warning("Failed to fetch tile z=%d x=%d y=%d: %s", z, x, y, exc)
        return None


# ── Mapbox Satellite ──────────────────────────────────────────────


def _fetch_mapbox_image(lat: float, lng: float) -> Image.Image | None:
    """Fetch high-res satellite imagery from Mapbox Static Images API.

    Uses zoom 18, 512x512 @2x for rooftop detail.
    Requires MAPBOX_ACCESS_TOKEN in settings.
    """
    token = getattr(settings, "MAPBOX_ACCESS_TOKEN", "")
    if not token or not token.strip() or "placeholder" in token.lower():
        return None

    try:
        # Mapbox Static Images: /lng,lat,zoom/widthxheight@2x
        url = f"{MAPBOX_STATIC_URL}/{lng},{lat},18,0/512x512@2x"
        params = {"access_token": token}
        resp = requests.get(url, params=params, timeout=15,
                            headers={"User-Agent": "UPA-Portal/1.0"})
        resp.raise_for_status()

        if "image" not in resp.headers.get("Content-Type", ""):
            return None

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        # Mapbox @2x returns 1024x1024, resize to 512x512
        if img.size != (512, 512):
            img = img.resize((512, 512), Image.LANCZOS)
        return img
    except Exception as exc:
        logger.debug("Mapbox fetch failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── Sentinel-2 ────────────────────────────────────────────────────


def _get_sentinel_token() -> str | None:
    """Obtain an OAuth2 token from Sentinel Hub."""
    client_id = getattr(settings, "SENTINEL_CLIENT_ID", "")
    client_secret = getattr(settings, "SENTINEL_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None
    if "placeholder" in client_id.lower() or "placeholder" in client_secret.lower():
        return None

    try:
        resp = requests.post(
            SENTINEL_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception as exc:
        logger.debug("Sentinel Hub token request failed: %s", exc)
        return None


def _fetch_sentinel_image(lat: float, lng: float) -> Image.Image | None:
    """Fetch Sentinel-2 L2A imagery via Sentinel Hub WMS.

    ~10m resolution — good for large-area scanning and change detection.
    Requires SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET in settings.
    """
    token = _get_sentinel_token()
    if not token:
        return None

    try:
        # ~200m bounding box around the point
        delta = 0.002
        bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"

        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "LAYERS": "TRUE-COLOR-S2L2A",
            "BBOX": bbox,
            "WIDTH": "512",
            "HEIGHT": "512",
            "CRS": "EPSG:4326",
            "FORMAT": "image/jpeg",
            "TIME": "",  # latest available
            "MAXCC": "20",  # max 20% cloud cover
        }
        resp = requests.get(
            SENTINEL_WMS_URL,
            params=params,
            timeout=20,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "UPA-Portal/1.0",
            },
        )
        resp.raise_for_status()

        if "image" not in resp.headers.get("Content-Type", ""):
            return None

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        return img
    except Exception as exc:
        logger.debug("Sentinel-2 fetch failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── Google Static Maps ────────────────────────────────────────────


def _fetch_google_static_image(lat: float, lng: float) -> Image.Image | None:
    """Fetch satellite imagery from Google Static Maps API.

    Uses zoom 20 for maximum rooftop detail.
    Requires GOOGLE_STATIC_MAPS_KEY in settings.
    """
    key = getattr(settings, "GOOGLE_STATIC_MAPS_KEY", "")
    if not key or not key.strip() or "placeholder" in key.lower():
        return None

    try:
        params = {
            "center": f"{lat},{lng}",
            "zoom": "20",
            "size": "640x640",
            "maptype": "satellite",
            "key": key,
        }
        resp = requests.get(GOOGLE_STATIC_URL, params=params, timeout=15,
                            headers={"User-Agent": "UPA-Portal/1.0"})
        resp.raise_for_status()

        if "image" not in resp.headers.get("Content-Type", ""):
            return None

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        # Resize to 512x512 for consistency
        if img.size != (512, 512):
            img = img.resize((512, 512), Image.LANCZOS)
        return img
    except Exception as exc:
        logger.debug("Google Static Maps fetch failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── ESRI World Imagery ────────────────────────────────────────────


def _fetch_esri_image(lat: float, lng: float) -> Image.Image | None:
    """
    Fetch satellite imagery from ESRI centred on (lat, lng), crop ~240 m around
    the property, and return a 512x512 PIL Image suitable for AI analysis.
    """
    tile_x, tile_y, px_x, px_y = lat_lng_to_pixel_in_tile(lat, lng, DEFAULT_ZOOM)

    # Stitch a 3×3 grid of tiles centred on the property tile
    grid_size = 3
    stitched = Image.new("RGB", (TILE_SIZE * grid_size, TILE_SIZE * grid_size), (0, 0, 0))

    for dy in range(-1, 2):
        for dx in range(-1, 2):
            tile = fetch_tile(DEFAULT_ZOOM, tile_x + dx, tile_y + dy)
            paste_x = (dx + 1) * TILE_SIZE
            paste_y = (dy + 1) * TILE_SIZE
            if tile:
                stitched.paste(tile, (paste_x, paste_y))

    # Property position within the stitched image
    center_x = TILE_SIZE + px_x  # offset by 1 tile (the -1 tile)
    center_y = TILE_SIZE + px_y

    # Crop 200×200 centred on property
    crop_half = 100
    left = max(center_x - crop_half, 0)
    top = max(center_y - crop_half, 0)
    right = min(center_x + crop_half, stitched.width)
    bottom = min(center_y + crop_half, stitched.height)

    cropped = stitched.crop((left, top, right, bottom))

    # Resize to 512×512 for AI consumption
    resized = cropped.resize((512, 512), Image.LANCZOS)
    return resized


# ── OpenAerialMap ─────────────────────────────────────────────────


def _fetch_oam_image(lat: float, lng: float) -> Image.Image | None:
    """Fetch imagery from OpenAerialMap (free, no API key)."""
    try:
        # Build a small bounding box (~500m) around the point
        delta = 0.005  # ~500m
        bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"
        params = {
            "bbox": bbox,
            "limit": 1,
            "order_by": "-acquisition_end",
        }
        resp = requests.get(OAM_META_URL, params=params, timeout=15,
                            headers={"User-Agent": "UPA-Portal/1.0"})
        resp.raise_for_status()
        data = resp.json()

        results = data.get("results", [])
        if not results:
            return None

        # Get the image URL (prefer smaller/preview if available)
        image_url = results[0].get("uuid")
        if not image_url:
            return None

        img_resp = requests.get(image_url, timeout=30,
                                headers={"User-Agent": "UPA-Portal/1.0"})
        img_resp.raise_for_status()
        img = Image.open(BytesIO(img_resp.content)).convert("RGB")

        # Resize to 512×512 for consistency
        return img.resize((512, 512), Image.LANCZOS)
    except Exception as exc:
        logger.debug("OAM fetch failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── USGS NAIP WMS ─────────────────────────────────────────────────


def _fetch_usgs_naip(lat: float, lng: float) -> Image.Image | None:
    """Fetch imagery from USGS NAIP WMS (free, no API key)."""
    try:
        # Build bbox around the point (~500m)
        delta = 0.005
        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "LAYERS": "USGSNAIPImagery:NaturalColor",
            "BBOX": f"{lat - delta},{lng - delta},{lat + delta},{lng + delta}",
            "WIDTH": "512",
            "HEIGHT": "512",
            "SRS": "EPSG:4326",
            "FORMAT": "image/jpeg",
        }
        resp = requests.get(USGS_NAIP_WMS_URL, params=params, timeout=20,
                            headers={"User-Agent": "UPA-Portal/1.0"})
        resp.raise_for_status()

        if "image" not in resp.headers.get("Content-Type", ""):
            return None

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        return img
    except Exception as exc:
        logger.debug("USGS NAIP fetch failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── Main entry point ──────────────────────────────────────────────


def fetch_roof_image(lat: float, lng: float) -> tuple[Image.Image | None, str]:
    """
    Fetch satellite imagery with cascade:
    Mapbox → Sentinel-2 → ESRI → Google Static Maps → OAM → USGS NAIP.

    Returns (image, source_name) where source_name is one of:
    "mapbox", "sentinel", "esri", "google", "oam", "usgs", or "none".
    """
    # 1. Mapbox Satellite — highest quality, requires API token
    img = _fetch_mapbox_image(lat, lng)
    if img:
        return img, "mapbox"

    # 2. Sentinel-2 — good for area scanning, requires Sentinel Hub credentials
    img = _fetch_sentinel_image(lat, lng)
    if img:
        return img, "sentinel"

    # 3. ESRI World Imagery — always available, no API key
    img = _fetch_esri_image(lat, lng)
    if img:
        return img, "esri"

    # 4. Google Static Maps — good detail, requires API key
    img = _fetch_google_static_image(lat, lng)
    if img:
        return img, "google"

    # 5. OpenAerialMap — free, no API key
    img = _fetch_oam_image(lat, lng)
    if img:
        return img, "oam"

    # 6. USGS NAIP WMS — free, no API key
    img = _fetch_usgs_naip(lat, lng)
    if img:
        return img, "usgs"

    return None, "none"
