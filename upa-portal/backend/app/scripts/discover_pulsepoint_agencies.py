#!/usr/bin/env python3
"""
Discover all valid PulsePoint agency IDs by probing the API.

Standalone script — no app imports required.
Uses httpx async for parallel probing with rate limiting.
Saves results to all_pulsepoint_agencies.json.
Resumes from checkpoint if interrupted.

A valid agency is one that returns at least one active or recent incident.
Invalid agency IDs still return 200 + encrypted data, but with empty lists.

Usage:
    python3 scripts/discover_pulsepoint_agencies.py
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import httpx

# ── Output paths ──
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = SCRIPT_DIR / "all_pulsepoint_agencies.json"
CHECKPOINT_FILE = SCRIPT_DIR / ".discover_checkpoint.json"

# ── PulsePoint API config ──
PULSEPOINT_BASE_URL = "https://api.pulsepoint.org/v1/webapp"
PULSEPOINT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Referer": "https://web.pulsepoint.org/",
    "Origin": "https://web.pulsepoint.org",
    "Accept": "application/json, text/plain, */*",
}

# Password derivation (same as app/utils/pulsepoint.py)
_e = "CommonIncidents"
PULSEPOINT_PASSWORD = (
    _e[13] + _e[1] + _e[2] + "brady" + "5" + "r" + _e.lower()[6] + _e[5] + "gs"
).encode()

# ── Rate limiting ──
MAX_CONCURRENT = 20
BATCH_DELAY_S = 0.1  # 100ms between batches

# ── ID ranges to probe ──
NUMERIC_RANGE = range(1, 100000)

ALPHA_PREFIXES = [
    "ECC", "PFC", "LAFD", "LACF", "OCFA", "SCC", "MCC",
    "FCC", "RCC", "BCC", "CCC", "DCC", "GCC", "HCC",
    "ICC", "JCC", "KCC", "LCC", "NCC", "OCC", "PCC",
    "QCC", "TCC", "UCC", "VCC", "WCC", "XCC", "YCC", "ZCC",
    "FDNY", "CFD", "BFD", "HFD", "DFD", "SFD", "PFD",
    "AFD", "MFD", "TFD", "WFD", "FFD", "GFD", "JFD", "KFD",
    "LFD", "NFD", "RFD",
]
ALPHA_SUFFIX_RANGE = range(0, 1000)


def _derive_key(password: bytes, salt: bytes) -> bytes:
    """EVP_BytesToKey style key derivation for AES-256."""
    key = b""
    block = None
    while len(key) < 32:
        hasher = hashlib.md5()
        if block:
            hasher.update(block)
        hasher.update(password)
        hasher.update(salt)
        block = hasher.digest()
        key += block
    return key[:32]


def decrypt_pulsepoint(data: dict) -> Optional[dict]:
    """Decrypt a PulsePoint API response. Returns None on failure."""
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

        salt = bytes.fromhex(data["s"])
        iv = bytes.fromhex(data["iv"])
        ciphertext = base64.b64decode(data["ct"])
        key = _derive_key(PULSEPOINT_PASSWORD, salt)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        raw = decryptor.update(ciphertext) + decryptor.finalize()
        out = raw[1 : raw.rindex(b'"')].decode("utf-8")
        out = out.replace(r"\"", '"')
        return json.loads(out)
    except Exception:
        return None


def _extract_location_from_incidents(incidents: list) -> Tuple[str, str]:
    """
    Try to extract a city/state from the first incident address.
    Addresses look like: "ROSE AVE, UNINCORPORATED, FL"
    Returns (city, state) or ("", "").
    """
    for inc in incidents:
        addr = inc.get("FullDisplayAddress", "")
        if not addr:
            continue
        parts = [p.strip() for p in addr.split(",")]
        if len(parts) >= 2:
            state = parts[-1].strip()
            city = parts[-2].strip() if len(parts) >= 3 else parts[0].strip()
            if len(state) == 2 and state.isalpha():
                return city, state.upper()
    return "", ""


def generate_all_ids() -> list:
    """Generate all candidate agency IDs to probe."""
    ids = []
    for n in NUMERIC_RANGE:
        ids.append(f"{n:05d}")
    for prefix in ALPHA_PREFIXES:
        for n in ALPHA_SUFFIX_RANGE:
            ids.append(f"{prefix}{n:05d}")
    return ids


def load_checkpoint() -> dict:
    """Load checkpoint with previously discovered agencies and last probed index."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return {"agencies": {}, "probed_ids": []}


def save_checkpoint(agencies: dict, probed_ids: set):
    """Save checkpoint to resume from."""
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(
            {"agencies": agencies, "probed_ids": sorted(probed_ids)},
            f,
        )


async def probe_agency(
    client: httpx.AsyncClient,
    agency_id: str,
    semaphore: asyncio.Semaphore,
) -> Tuple[str, Optional[dict]]:
    """
    Probe a single agency ID.

    Returns (agency_id, info_dict) if valid, (agency_id, None) if invalid.
    A valid agency has at least one active or recent incident.
    """
    async with semaphore:
        url = f"{PULSEPOINT_BASE_URL}?resource=incidents&agencyid={agency_id}"
        try:
            resp = await client.get(url, headers=PULSEPOINT_HEADERS, timeout=15)
            if resp.status_code != 200:
                return agency_id, None

            payload = resp.json()
            if not all(k in payload for k in ("ct", "iv", "s")):
                return agency_id, None

            decrypted = decrypt_pulsepoint(payload)
            if decrypted is None:
                return agency_id, None

            # Check for actual incidents — this is how we distinguish
            # valid agencies from non-existent ones
            incidents = decrypted.get("incidents", {})
            active = incidents.get("active", [])
            recent = incidents.get("recent", [])

            if not active and not recent:
                return agency_id, None

            # Extract location from incident addresses
            all_incidents = active + recent
            city, state = _extract_location_from_incidents(all_incidents)

            # Build a descriptive name from city
            name = f"{city} Fire Department" if city else f"Agency {agency_id}"

            return agency_id, {
                "agencyid": agency_id,
                "agencyname": name,
                "state": state,
                "incident_count": len(active) + len(recent),
            }

        except (httpx.TimeoutException, httpx.ConnectError):
            return agency_id, None
        except Exception:
            return agency_id, None


async def discover():
    all_ids = generate_all_ids()
    print(f"Total candidate IDs to probe: {len(all_ids):,}", flush=True)

    # Load checkpoint
    checkpoint = load_checkpoint()
    agencies = checkpoint.get("agencies", {})
    already_probed = set(checkpoint.get("probed_ids", []))
    print(
        f"Checkpoint: {len(agencies)} agencies found, "
        f"{len(already_probed):,} already probed",
        flush=True,
    )

    # Filter out already-probed IDs
    remaining = [aid for aid in all_ids if aid not in already_probed]
    print(f"Remaining to probe: {len(remaining):,}", flush=True)

    if not remaining:
        print("All IDs already probed. Saving final output.", flush=True)
        _save_output(agencies)
        return

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    probed_count = 0
    found_count = len(agencies)
    start_time = time.time()

    async with httpx.AsyncClient(http2=False) as client:
        for batch_start in range(0, len(remaining), MAX_CONCURRENT):
            batch = remaining[batch_start : batch_start + MAX_CONCURRENT]
            tasks = [probe_agency(client, aid, semaphore) for aid in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    continue
                agency_id, info = result
                already_probed.add(agency_id)
                if info is not None:
                    agencies[agency_id] = info
                    found_count += 1

            probed_count += len(batch)

            if probed_count % 500 == 0 or probed_count == len(remaining):
                elapsed = time.time() - start_time
                rate = probed_count / elapsed if elapsed > 0 else 0
                print(
                    f"  Probed {probed_count:,}/{len(remaining):,} "
                    f"({rate:.0f}/s) — {found_count} valid agencies found",
                    flush=True,
                )
                save_checkpoint(agencies, already_probed)

            await asyncio.sleep(BATCH_DELAY_S)

    # Final save
    save_checkpoint(agencies, already_probed)
    _save_output(agencies)

    elapsed = time.time() - start_time
    print(f"\nDone! Found {found_count} valid agencies in {elapsed:.0f}s", flush=True)
    print(f"Output: {OUTPUT_FILE}", flush=True)


def _save_output(agencies: dict):
    """Save the final output JSON file in the format expected by seed_agencies_local.py."""
    output = {}
    for agency_id, info in sorted(agencies.items()):
        name = info.get("agencyname", f"Agency {agency_id}")
        # Use a unique key (agency_id prefix) to avoid collisions for same-name agencies
        key = f"{name} ({agency_id})"
        output[key] = {
            "agency": {
                "agencyid": agency_id,
                "agencyname": name,
                "state": info.get("state", ""),
            }
        }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Saved {len(output)} agencies to {OUTPUT_FILE}", flush=True)


if __name__ == "__main__":
    asyncio.run(discover())
