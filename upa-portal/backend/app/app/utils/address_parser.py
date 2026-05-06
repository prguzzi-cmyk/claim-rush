#!/usr/bin/env python

"""Address parsing utilities for normalizing flat address strings into
structured (street, city, state, zip) parts.

The PulsePoint feed returns ``FullDisplayAddress`` as a comma-delimited
string of the form::

    "STREET, CITY, STATE"

or, less commonly::

    "STREET, CITY, STATE 12345"

Some manually-entered records also include a ZIP suffix or omit fields
entirely. This module is intentionally tolerant: it never raises, and
returns an :class:`AddressParts` with whatever it could extract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# Two-letter US state codes (postal abbreviations + DC + territories).
US_STATE_CODES: frozenset[str] = frozenset(
    {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
        "DC", "PR", "GU", "VI", "AS", "MP",
    }
)

# US ZIP: 5 digits, optionally followed by -dddd.
_ZIP_RE = re.compile(r"\b(\d{5}(?:-\d{4})?)\b")
_TRAILING_ZIP_RE = re.compile(r"\s+(\d{5}(?:-\d{4})?)\s*$")


@dataclass
class AddressParts:
    street_address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    full_address: str | None = None

    def is_empty(self) -> bool:
        return not any(
            (self.street_address, self.city, self.state, self.zip_code)
        )


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().strip(",").strip()
    return cleaned or None


def _split_state_zip(token: str) -> tuple[str | None, str | None]:
    """Split a trailing ``"STATE"``, ``"STATE ZIP"``, or ``"ZIP"`` token."""
    token = token.strip()
    if not token:
        return None, None

    zip_match = _TRAILING_ZIP_RE.search(token)
    zip_code = zip_match.group(1) if zip_match else None
    if zip_match:
        token = token[: zip_match.start()].strip()

    state: str | None = None
    if token:
        upper = token.upper()
        if upper in US_STATE_CODES:
            state = upper
        elif len(upper) > 2 and upper[-2:] in US_STATE_CODES and upper[-3] == " ":
            state = upper[-2:]
        else:
            state = token

    return state, zip_code


def parse_address(raw: str | None, *, fallback_state: str | None = None) -> AddressParts:
    """Parse a flat US address string into :class:`AddressParts`.

    Handles the PulsePoint ``"STREET, CITY, STATE"`` format and common
    variants. ``fallback_state`` is used when no state can be inferred from
    the string itself (typically the parent agency's state).

    Returns an :class:`AddressParts` with whatever it could extract — the
    function never raises.
    """
    cleaned = _clean(raw)
    if not cleaned:
        out = AddressParts()
        if fallback_state:
            out.state = fallback_state.upper()
        return out

    full_address = cleaned

    # ZIP is only accepted when it appears in a state/zip slot (after the
    # state token) or as the very last whitespace-separated token of a
    # single-segment string — never from a free-floating ``_ZIP_RE.search``.
    # Free-floating extraction caused 5-digit street numbers like
    # ``14661 US HIGHWAY 1`` to be mis-read as ZIP ``14661``.
    zip_code: str | None = None

    parts: Iterable[str] = (p.strip() for p in cleaned.split(","))
    parts_list = [p for p in parts if p]

    street_address: str | None = None
    city: str | None = None
    state: str | None = None

    if len(parts_list) >= 3:
        # "STREET, CITY, STATE [ZIP]" — most common PulsePoint shape.
        street_address = parts_list[0]
        city = parts_list[1]
        state, parsed_zip = _split_state_zip(parts_list[2])
        zip_code = zip_code or parsed_zip
        # If there are extra trailing tokens, fold them back into street.
        if len(parts_list) > 3:
            street_address = ", ".join(parts_list[: len(parts_list) - 2])
            city = parts_list[-2]
            state, parsed_zip = _split_state_zip(parts_list[-1])
            zip_code = zip_code or parsed_zip
    elif len(parts_list) == 2:
        # Could be "STREET, CITY STATE [ZIP]" (no comma before state)
        street_address = parts_list[0]
        tail = parts_list[1]
        # Try to peel a trailing state token from the right side.
        tail_tokens = tail.split()
        if tail_tokens:
            last_is_zip = bool(_ZIP_RE.fullmatch(tail_tokens[-1]))
            if last_is_zip:
                zip_code = zip_code or tail_tokens[-1]
                tail_tokens = tail_tokens[:-1]
            if tail_tokens and tail_tokens[-1].upper() in US_STATE_CODES:
                state = tail_tokens[-1].upper()
                tail_tokens = tail_tokens[:-1]
            city = " ".join(tail_tokens) or None
    elif len(parts_list) == 1:
        # Single token — best we can do is treat it as the street.
        street_address = parts_list[0]
        # If the lone token ends in " STATE" or " STATE ZIP", peel it off.
        tokens = street_address.split()
        if tokens:
            last_is_zip = bool(_ZIP_RE.fullmatch(tokens[-1]))
            if last_is_zip:
                zip_code = zip_code or tokens[-1]
                tokens = tokens[:-1]
            if tokens and tokens[-1].upper() in US_STATE_CODES:
                state = tokens[-1].upper()
                tokens = tokens[:-1]
            street_address = " ".join(tokens) or street_address

    if not state and fallback_state:
        state = fallback_state.upper()
    if state:
        # Normalize 2-letter state to upper-case if recognizable.
        upper = state.upper()
        state = upper if upper in US_STATE_CODES else state

    return AddressParts(
        street_address=_clean(street_address),
        city=_clean(city),
        state=_clean(state),
        zip_code=_clean(zip_code),
        full_address=full_address,
    )
