#!/usr/bin/env python

"""In-memory TTL store for WebAuthn challenges"""

import time
from threading import Lock

_TTL_SECONDS = 300  # 5 minutes
_store: dict[str, tuple[bytes, float]] = {}
_lock = Lock()


def save_challenge(key: str, challenge: bytes) -> None:
    """Store a challenge keyed by user identifier."""
    with _lock:
        _store[key] = (challenge, time.time())


def get_challenge(key: str) -> bytes | None:
    """Retrieve and consume a challenge. Returns None if expired/missing."""
    with _lock:
        entry = _store.pop(key, None)
    if entry is None:
        return None
    challenge, ts = entry
    if time.time() - ts > _TTL_SECONDS:
        return None
    return challenge


def cleanup() -> None:
    """Remove expired entries."""
    now = time.time()
    with _lock:
        expired = [k for k, (_, ts) in _store.items() if now - ts > _TTL_SECONDS]
        for k in expired:
            del _store[k]
