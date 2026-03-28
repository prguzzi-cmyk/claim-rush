#!/usr/bin/env python

"""Skip trace utility — looks up property owner info by address.

Provider interface so the free TruePeopleSearch source can be swapped for a
paid API later by just changing SKIP_TRACE_PROVIDER in config.
"""

import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from app.core.config import settings
from app.core.log import logger

# Call types eligible for automatic skip tracing
SKIP_TRACE_CALL_TYPES = {"SF", "CF"}


@dataclass
class SkipTraceResident:
    full_name: str
    phone_numbers: list[str] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    age: Optional[str] = None


@dataclass
class SkipTraceResult:
    residents: list[SkipTraceResident] = field(default_factory=list)


# ---------------------------------------------------------------------------
# TruePeopleSearch provider (free, via Scrape.do proxy)
# ---------------------------------------------------------------------------

def _parse_address_parts(address: str) -> tuple[str, str]:
    """Split a full address into (street, city_state_zip).

    Tries to split on the last comma that separates street from city/state/zip.
    Falls back to using the whole string as both parts.
    """
    # Typical format: "123 Main St, Springfield, IL 62701"
    # We want street="123 Main St" and city_state_zip="Springfield, IL 62701"
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        street = parts[0]
        city_state_zip = ", ".join(parts[1:])
    else:
        street = address
        city_state_zip = address
    return street, city_state_zip


def _truepeoplesearch_lookup(address: str) -> Optional[SkipTraceResult]:
    """Look up residents at an address using TruePeopleSearch via Scrape.do."""
    token = settings.SCRAPE_DO_API_TOKEN
    if not token:
        logger.warning("skip_trace: SCRAPE_DO_API_TOKEN not set, skipping lookup")
        return None

    street, city_state_zip = _parse_address_parts(address)

    tps_url = (
        f"https://www.truepeoplesearch.com/results?"
        f"streetaddress={quote_plus(street)}&citystatezip={quote_plus(city_state_zip)}"
    )
    scrape_url = (
        f"https://api.scrape.do?token={token}"
        f"&url={quote_plus(tps_url)}&render=true"
    )

    timeout = settings.SKIP_TRACE_TIMEOUT
    logger.info("skip_trace: querying TruePeopleSearch for address=%s", address)

    try:
        resp = requests.get(scrape_url, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("skip_trace: Scrape.do request failed: %s", exc)
        return None

    return _parse_tps_html(resp.text)


def _parse_tps_html(html: str) -> Optional[SkipTraceResult]:
    """Extract resident info from TruePeopleSearch HTML."""
    soup = BeautifulSoup(html, "html.parser")

    residents: list[SkipTraceResident] = []

    # Each result card is a div with class "card card-block shadow-form card-summary"
    cards = soup.select("div.card.card-summary")
    if not cards:
        # Fallback: try broader selectors
        cards = soup.select("div.card-block")

    for card in cards:
        # Name: look for h4 or .h4 heading
        name_el = card.select_one(".h4") or card.select_one("h4")
        if not name_el:
            continue
        full_name = name_el.get_text(strip=True)
        if not full_name:
            continue

        # Phone numbers: <span itemprop="telephone">
        phone_els = card.select('span[itemprop="telephone"]')
        phones = []
        for el in phone_els:
            phone = el.get_text(strip=True)
            if phone:
                phones.append(phone)

        # Also try data-link-to-more phone patterns
        if not phones:
            phone_pattern = re.compile(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
            phone_section = card.select_one(".detail-box-phone")
            if phone_section:
                phones = phone_pattern.findall(phone_section.get_text())

        # Emails: look for email patterns in card text
        emails = []
        email_section = card.select_one(".detail-box-email")
        if email_section:
            email_pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
            emails = email_pattern.findall(email_section.get_text())
        if not emails:
            # Fallback: scan entire card text
            email_pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
            card_text = card.get_text()
            emails = email_pattern.findall(card_text)

        # Age
        age = None
        age_el = card.select_one(".content-value")
        if age_el:
            age_text = age_el.get_text(strip=True)
            age_match = re.search(r"Age\s+(\d+)", age_text)
            if age_match:
                age = age_match.group(1)

        residents.append(
            SkipTraceResident(
                full_name=full_name,
                phone_numbers=phones[:5],  # Cap at 5 numbers
                emails=list(dict.fromkeys(emails))[:3],  # Dedupe, cap at 3
                age=age,
            )
        )

        if len(residents) >= 5:  # Cap total residents
            break

    if not residents:
        logger.info("skip_trace: no residents found for address")
        return None

    return SkipTraceResult(residents=residents)


# ---------------------------------------------------------------------------
# SkipSherpa provider (paid API)
# ---------------------------------------------------------------------------

def _parse_address_components(address: str) -> dict[str, str]:
    """Parse a full address string into street/city/state/zip components."""
    parts = [p.strip() for p in address.split(",")]
    result = {"street": "", "city": "", "state": "", "zip": ""}

    if len(parts) >= 3:
        result["street"] = parts[0]
        result["city"] = parts[1]
        # Last part may be "IL 60601" or "IL" + "60601"
        state_zip = parts[2].strip()
        sz_parts = state_zip.split()
        if len(sz_parts) >= 2:
            result["state"] = sz_parts[0]
            result["zip"] = sz_parts[1]
        elif len(sz_parts) == 1:
            result["state"] = sz_parts[0]
        # Check if there's a 4th part (zip separate)
        if len(parts) >= 4:
            result["zip"] = parts[3].strip()
    elif len(parts) == 2:
        result["street"] = parts[0]
        state_zip = parts[1].strip()
        sz_parts = state_zip.split()
        if len(sz_parts) >= 3:
            result["city"] = sz_parts[0]
            result["state"] = sz_parts[1]
            result["zip"] = sz_parts[2]
        elif len(sz_parts) >= 2:
            result["state"] = sz_parts[0]
            result["zip"] = sz_parts[1]
    else:
        result["street"] = address

    return result


@dataclass
class SkipTraceMailingAddress:
    street: str = ""
    street2: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""


@dataclass
class SkipTraceResident2(SkipTraceResident):
    """Extended resident with structured name and mailing address."""
    first_name: str = ""
    middle_name: str = ""
    last_name: str = ""
    mailing_address: Optional[SkipTraceMailingAddress] = None
    raw_response: Optional[dict] = None


def _skipsherpa_lookup(address: str) -> Optional[SkipTraceResult]:
    """Look up property owner at an address using the SkipSherpa beta6 API.

    Docs: PUT /api/beta6/properties
    Auth: API-Key header
    """
    api_key = settings.SKIPSHERPA_API_KEY
    base_url = settings.SKIPSHERPA_BASE_URL

    if not api_key:
        logger.warning("skip_trace: SKIPSHERPA_API_KEY not set, skipping lookup")
        return None

    addr = _parse_address_components(address)
    url = f"{base_url.rstrip('/')}/api/beta6/properties"
    headers = {
        "API-Key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "property_lookups": [
            {
                "property_address_lookup": {
                    "street": addr["street"],
                    "city": addr["city"],
                    "state": addr["state"],
                    "zipcode": addr["zip"],
                },
                "success_criteria": "owner-name",
            }
        ]
    }

    timeout = settings.SKIP_TRACE_TIMEOUT
    logger.info("skip_trace: querying SkipSherpa for address=%s", address)

    try:
        resp = requests.put(url, json=payload, headers=headers, timeout=timeout)
        # SkipSherpa returns HTTP 404 when property not found — that's a valid
        # "no data" response, not an error.  Only raise on 5xx / connection issues.
        if resp.status_code >= 500:
            resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("skip_trace: SkipSherpa request failed: %s", exc)
        return None

    data = resp.json()
    logger.info("skip_trace: SkipSherpa HTTP %s, parsing response", resp.status_code)
    return _parse_skipsherpa_response(data)


def _parse_skipsherpa_response(data: dict) -> Optional[SkipTraceResult]:
    """Parse SkipSherpa beta6 /properties response into SkipTraceResult."""
    if not data:
        return None

    property_results = data.get("property_results", [])
    if not property_results:
        logger.info("skip_trace: SkipSherpa returned empty property_results")
        return None

    residents: list[SkipTraceResident] = []

    for pr in property_results:
        status_code = pr.get("status_code", 0)
        prop = pr.get("property")
        if not prop:
            logger.info("skip_trace: SkipSherpa result status_code=%s, no property", status_code)
            continue

        # Extract tax mailing address from property level
        tax_mailing = prop.get("tax_mailing_address") or {}
        tax_us = tax_mailing.get("us_address") or {}

        for owner_obj in prop.get("owners", []):
            # Handle person owners
            person = owner_obj.get("person")
            if person:
                pn = person.get("person_name", {})
                first = pn.get("first_name", "")
                middle = pn.get("middle_name", "")
                last = pn.get("last_name", "")
                full_name = person.get("name", "")
                if not full_name:
                    full_name = " ".join(p for p in [first, middle, last] if p)

                # Phone numbers
                phones = []
                for ph in person.get("phone_numbers", []):
                    local_fmt = ph.get("local_format", "")
                    if local_fmt:
                        phones.append(local_fmt)
                    elif ph.get("e164_format"):
                        phones.append(ph["e164_format"])

                # Emails
                emails = []
                for em in person.get("emails", []):
                    addr_val = em.get("email_address", "")
                    if addr_val:
                        emails.append(addr_val)

                # Age
                age = person.get("age")
                if age is not None:
                    age = str(age)

                # Mailing address — prefer owner's first address, fallback to tax mailing
                mailing = None
                owner_addresses = person.get("addresses", [])
                addr_src = owner_addresses[0] if owner_addresses else tax_mailing
                if addr_src:
                    us = addr_src.get("us_address") or {}
                    mailing = SkipTraceMailingAddress(
                        street=us.get("street", "") or addr_src.get("delivery_line1", ""),
                        street2=addr_src.get("delivery_line2", "") or "",
                        city=us.get("city", "") or us.get("city_name", ""),
                        state=us.get("state", "") or us.get("state_abbreviation", ""),
                        zip_code=us.get("zipcode", ""),
                    )

                residents.append(
                    SkipTraceResident2(
                        full_name=full_name,
                        phone_numbers=phones[:5],
                        emails=list(dict.fromkeys(emails))[:3],
                        age=age,
                        first_name=first,
                        middle_name=middle,
                        last_name=last,
                        mailing_address=mailing,
                        raw_response=owner_obj,
                    )
                )

            # Handle business owners
            biz = owner_obj.get("business")
            if biz and not person:
                biz_name = biz.get("name", "")
                phones = []
                for ph in biz.get("phone_numbers", []):
                    local_fmt = ph.get("local_format", "")
                    if local_fmt:
                        phones.append(local_fmt)
                emails = []
                for em in biz.get("emails", []):
                    if em.get("email_address"):
                        emails.append(em["email_address"])

                residents.append(
                    SkipTraceResident(
                        full_name=biz_name,
                        phone_numbers=phones[:5],
                        emails=list(dict.fromkeys(emails))[:3],
                    )
                )

    if not residents:
        logger.info("skip_trace: no owners found in SkipSherpa response")
        return None

    return SkipTraceResult(residents=residents)


# ---------------------------------------------------------------------------
# Provider dispatch
# ---------------------------------------------------------------------------

_PROVIDERS = {
    "truepeoplesearch": _truepeoplesearch_lookup,
    "skipsherpa": _skipsherpa_lookup,
}


def skip_trace_address(address: str) -> Optional[SkipTraceResult]:
    """Look up property owner(s) at an address using the configured provider.

    Returns None if the provider is disabled, not configured, or the lookup fails.
    """
    provider = settings.SKIP_TRACE_PROVIDER.lower()
    if provider == "none":
        return None

    lookup_fn = _PROVIDERS.get(provider)
    if lookup_fn is None:
        logger.warning("skip_trace: unknown provider '%s'", provider)
        return None

    try:
        return lookup_fn(address)
    except Exception as exc:
        logger.error("skip_trace: provider '%s' raised: %s", provider, exc)
        return None
