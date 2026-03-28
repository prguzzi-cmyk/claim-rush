#!/usr/bin/env python

"""PulsePoint API client and AES-256-CBC decryption utility."""

import base64
import hashlib
import json
from typing import Optional

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from app.core.log import logger

PULSEPOINT_BASE_URL = "https://api.pulsepoint.org/v1/webapp"
PULSEPOINT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://web.pulsepoint.org/",
    "Origin": "https://web.pulsepoint.org",
    "Accept": "application/json, text/plain, */*",
}

# Obfuscated password: e[13]+e[1]+e[2]+"brady"+"5"+"r"+e.lower()[6]+e[5]+"gs"
# where e = "CommonIncidents"  → "tombrady5rings"
_e = "CommonIncidents"
PULSEPOINT_PASSWORD = (
    _e[13] + _e[1] + _e[2] + "brady" + "5" + "r" + _e.lower()[6] + _e[5] + "gs"
).encode()

CALL_TYPE_DESCRIPTIONS = {
    # ── Fire Types ──
    "SF": "Structure Fire",
    "CF": "Commercial Fire",
    "RF": "Residential Fire",
    "WSF": "Confirmed Structure Fire",
    "WCF": "Working Commercial Fire",
    "WRF": "Working Residential Fire",
    "FF": "Forest/Wildland Fire",
    "VEG": "Vegetation Fire",
    "WVEG": "Confirmed Vegetation Fire",
    "VF": "Vehicle Fire",
    "AF": "Appliance Fire",
    "CHIM": "Chimney Fire",
    "ELF": "Electrical Fire",
    "GF": "Grass Fire",
    "MF": "Marine Fire",
    "OF": "Outside Fire",
    "PF": "Pole Fire",
    "TF": "Tank Fire",
    "WF": "Working Fire",
    "CB": "Controlled Burn",
    "EF": "Extinguished Fire",
    "FIRE": "Fire",
    "FULL": "Full Assignment",
    "IF": "Illegal Fire",
    # ── Alarms ──
    "FA": "Fire Alarm",
    "BA": "Building Alarm",
    "AED": "AED Alarm",
    "MA": "Manual Alarm",
    "SD": "Smoke Detector",
    "TRBL": "Trouble Alarm",
    "WFA": "Waterflow Alarm",
    "CMA": "Carbon Monoxide Alarm",
    # ── Medical ──
    "ME": "Medical Emergency",
    "EMS": "EMS Call",
    "CPR": "CPR Needed",
    "IFT": "Interfacility Transfer",
    "MCI": "Multi Casualty",
    "CP": "Community Paramedicine",
    # ── Traffic / Vehicle ──
    "TC": "Traffic Collision",
    "TCE": "Expanded Traffic Collision",
    "TCP": "Collision Involving Pedestrian",
    "TCS": "Collision Involving Structure",
    "TCT": "Collision Involving Train",
    "MV": "Motor Vehicle Accident",
    "RTE": "Railroad/Train Emergency",
    # ── Hazmat / Utilities ──
    "HA": "Hazmat",
    "HMR": "Hazmat Response",
    "HMI": "Hazmat Investigation",
    "CO": "Carbon Monoxide",
    "GAS": "Gas Leak",
    "HC": "Hazardous Condition",
    "EE": "Electrical Emergency",
    "PLE": "Powerline Emergency",
    "WA": "Wires Arcing",
    "WD": "Wires Down",
    "WDA": "Wires Down/Arcing",
    "PE": "Pipeline Emergency",
    "EX": "Explosion",
    "TE": "Transformer Explosion",
    "SH": "Sheared Hydrant",
    # ── Rescue ──
    "RS": "Rescue",
    "RES": "Rescue",
    "AR": "Animal Rescue",
    "CR": "Cliff Rescue",
    "CSR": "Confined Space Rescue",
    "ELR": "Elevator Rescue",
    "EER": "Elevator/Escalator Rescue",
    "IR": "Ice Rescue",
    "RR": "Rope Rescue",
    "TR": "Technical Rescue",
    "TNR": "Trench Rescue",
    "USAR": "Urban Search and Rescue",
    "WR": "Water Rescue",
    "SC": "Structural Collapse",
    "VS": "Vessel Sinking",
    "IA": "Industrial Accident",
    # ── Investigation ──
    "AI": "Arson Investigation",
    "FWI": "Fireworks Investigation",
    "INV": "Investigation",
    "OI": "Odor Investigation",
    "SI": "Smoke Investigation",
    # ── Service / Public Assist ──
    "OA": "Outside Alert",
    "PS": "Public Service",
    "LA": "Lift Assist",
    "PA": "Police Assist",
    "FL": "Flooding",
    "LR": "Ladder Request",
    "BT": "Bomb Threat",
    "EM": "Emergency",
    "ER": "Emergency Response",
    "TD": "Tree Down",
    "WE": "Water Emergency",
    # ── Lockout ──
    "CL": "Commercial Lockout",
    "LO": "Lockout",
    "RL": "Residential Lockout",
    "VL": "Vehicle Lockout",
    # ── Aircraft ──
    "AC": "Aircraft Crash",
    "AE": "Aircraft Emergency",
    "AES": "Aircraft Emergency Standby",
    "LZ": "Landing Zone",
    # ── Mutual Aid ──
    "AA": "Auto Aid",
    "MU": "Mutual Aid",
    "ST": "Strike Team/Task Force",
    # ── Weather / Natural Disaster ──
    "EQ": "Earthquake",
    "FLW": "Flood Warning",
    "TOW": "Tornado Warning",
    "TSW": "Tsunami Warning",
    "WX": "Weather Incident",
    # ── Administrative ──
    "BP": "Burn Permit",
    "CA": "Community Activity",
    "FW": "Fire Watch",
    "MC": "Move-up/Cover",
    "NO": "Notification",
    "STBY": "Standby",
    "TEST": "Test",
    "TRNG": "Training",
    # ── Multi-Source (portal-specific) ──
    "SAT": "Satellite Detected Fire",
    "911": "911 Dispatch Fire",
}


def _derive_key(password: bytes, salt: bytes) -> bytes:
    """
    Derive a 32-byte AES key using iterative MD5 hashing (EVP_BytesToKey style).
    Each round: MD5(previous_block + password + salt).
    """
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


def decrypt_pulsepoint(data: dict) -> dict:
    """
    Decrypt a PulsePoint API response using AES-256-CBC.

    The response contains:
    - ``ct``: base64-encoded ciphertext
    - ``iv``: hex-encoded initialization vector
    - ``s``: hex-encoded salt

    The plaintext is a JSON-escaped string wrapped in outer quotes.
    """
    salt = bytes.fromhex(data["s"])
    iv = bytes.fromhex(data["iv"])
    ciphertext = base64.b64decode(data["ct"])

    key = _derive_key(PULSEPOINT_PASSWORD, salt)

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    raw = decryptor.update(ciphertext) + decryptor.finalize()

    # Plaintext is a quoted, escaped JSON string: `"{ ... }"`
    # Strip the leading `"`, find the last `"`, then unescape.
    out = raw[1 : raw.rindex(b'"')].decode("utf-8")
    out = out.replace(r"\"", '"')
    return json.loads(out)


def fetch_pulsepoint_incidents(agency_id: str) -> Optional[dict]:
    """
    Fetch and decrypt live incidents from the PulsePoint public API.

    Parameters
    ----------
    agency_id : str
        PulsePoint agency ID (e.g. "65060" or "ECC00005").

    Returns
    -------
    dict or None
        Decrypted response dict containing incident lists, or None on failure.
    """
    url = f"{PULSEPOINT_BASE_URL}?resource=incidents&agencyid={agency_id}"
    try:
        response = requests.get(url, headers=PULSEPOINT_HEADERS, timeout=15)
        response.raise_for_status()
        return decrypt_pulsepoint(response.json())
    except Exception as exc:
        logger.error(f"PulsePoint fetch failed for agency {agency_id}: {exc}")
        return None


def get_call_type_description(call_type: str) -> str:
    """Return a human-readable description for a PulsePoint call type code."""
    return CALL_TYPE_DESCRIPTIONS.get(call_type, call_type)
