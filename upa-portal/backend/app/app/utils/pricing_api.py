#!/usr/bin/env python

"""External Craftsman pricing API client."""

import httpx

from app.core.config import settings
from app.core.log import logger


def search_pricing(query: str) -> list[dict]:
    """
    Search the external Craftsman pricing API for items matching the query.

    Returns a list of dicts with keys matching PricingItemCreate fields.
    Returns an empty list if the API is not configured or on error.
    """
    api_url = getattr(settings, "PRICING_API_URL", "")
    api_key = getattr(settings, "PRICING_API_KEY", "")
    timeout = getattr(settings, "PRICING_API_TIMEOUT", 15)

    if not api_url or not api_key:
        logger.warning("Pricing API not configured (PRICING_API_URL or PRICING_API_KEY empty).")
        return []

    url = f"{api_url.rstrip('/')}/search"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"q": query}

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.error(f"Pricing API search failed for query '{query}': {exc}")
        return []

    if not isinstance(data, list):
        return []

    return data
