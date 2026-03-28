#!/usr/bin/env python

"""
Source router — maps provider codes to RIN source IDs.

Hot-path utility: no DB dependency after initial load.
"""

from __future__ import annotations

from uuid import UUID

# Deterministic UUIDs matching the Alembic migration seed rows.
_SOURCE_ID_MAP: dict[str, UUID] = {
    "pulsepoint": UUID("00000000-0000-4000-a000-000000000001"),
    "socrata": UUID("00000000-0000-4000-a000-000000000002"),
    "nifc": UUID("00000000-0000-4000-a000-000000000003"),
    "firms": UUID("00000000-0000-4000-a000-000000000004"),
}

_ID_TO_CODE_MAP: dict[UUID, str] = {v: k for k, v in _SOURCE_ID_MAP.items()}


def get_source_id(provider_code: str) -> UUID | None:
    """Resolve 'pulsepoint' → source_id UUID."""
    return _SOURCE_ID_MAP.get(provider_code)


def get_provider_code(source_id: UUID) -> str | None:
    """Reverse lookup: source_id → 'pulsepoint' (internal only)."""
    return _ID_TO_CODE_MAP.get(source_id)


def get_display_name(source_id: UUID | None = None) -> str:
    """Always returns 'RIN Network' — the public-facing brand."""
    return "RIN Network"
