#!/usr/bin/env python

"""Home-office uncovered-state hourly digest.

Once an hour, count leads landed on the RIN Home Office system user in the
last hour, grouped by state. For each state with at least one new lead,
email pguzzi@upaclaim.org a one-line digest. If no states match, send
nothing — silence is the green signal.

This closes the loop on Stage 3's rotation change: when a fire incident
arrives in a state with no active Chapter President, the rotation engine
parks the lead on the home office user. Pete's Master Watch surfaces it
visually; this digest pages him via email so he doesn't have to refresh
the dashboard to notice a state going hot.

Suppression
-----------
The Stage 2 backfill UPDATE used a `SET LOCAL upa.skip_notify = 'true'`
marker as forward-compatible defensive code. It is a no-op for this
digest because the digest is poll-based on `lead.created_at >= NOW() -
INTERVAL '1 hour'`, and the backfilled rows kept their (older)
`created_at` timestamps — they fall outside the rollup window by
construction. If a future per-row notify path is added (e.g. a SQLAlchemy
event listener that fires on assignment changes), it can read the flag
via `current_setting('upa.skip_notify', true)` to skip during bulk
operations.

Failure handling
----------------
SMTP failures are logged and skipped — same pattern as
fire_agency_audit_alert. We don't retry forever; one missed digest is
recoverable from the dashboard, and a failing SMTP path that loops would
itself be more disruptive than a single skipped tick.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.utils.emails import send_email

logger = logging.getLogger(__name__)

ALERT_TO = "pguzzi@upaclaim.org"
HOME_OFFICE_USER_ID = "00000000-0000-0000-0000-000000000001"


@celery_app.task(name="home_office_state_digest.send_hourly_digest")
def send_hourly_digest() -> int:
    """Send one email per state with home-office leads from the last hour.

    Returns
    -------
    int
        Number of emails sent this tick. Zero is normal and means no
        uncovered states ingested in the last hour.
    """
    sent = 0
    with SessionLocal() as session:
        rows = session.execute(text("""
            SELECT
                COALESCE(NULLIF(TRIM(lc.state_loss), ''), '<unknown>') AS state,
                COUNT(*) AS lead_count,
                MIN(l.created_at) AS oldest_in_window,
                MAX(l.created_at) AS newest_in_window
            FROM lead l
            LEFT JOIN lead_contact lc ON lc.lead_id = l.id
            WHERE l.assigned_to = :home_office_id
              AND l.is_removed = FALSE
              AND l.created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY 1
            HAVING COUNT(*) > 0
            ORDER BY lead_count DESC, state ASC
        """), {"home_office_id": HOME_OFFICE_USER_ID}).fetchall()

    if not rows:
        logger.info("home_office_state_digest: no uncovered-state leads in last 1h — silent")
        return 0

    for r in rows:
        subject = (
            f"[RIN] Uncovered state: {r.state} — {r.lead_count} "
            f"lead{'s' if r.lead_count != 1 else ''} now in Home Office"
        )
        body_plain = (
            f"State {r.state} has {r.lead_count} new fire-lead"
            f"{'s' if r.lead_count != 1 else ''} on the RIN Home Office "
            f"queue in the last hour.\n\n"
            f"  state:           {r.state}\n"
            f"  count:           {r.lead_count}\n"
            f"  window:          {r.oldest_in_window}  →  {r.newest_in_window}\n"
            f"  owner:           RIN Home Office (system user)\n"
            f"  routing reason:  no Chapter President covers this state\n\n"
            f"View the queue (admin only):\n"
            f"  https://rin.aciunited.com/app/leads/home-office\n\n"
            f"Action: assign a CP to {r.state}, or delegate these leads "
            f"manually from the Home Office Queue dashboard.\n"
        )
        try:
            send_email(
                to=ALERT_TO,
                subject=subject,
                body_html=body_plain.replace("\n", "<br>"),
                body_plain=body_plain,
            )
            sent += 1
            logger.info(
                "home_office_state_digest: emailed state=%s count=%d",
                r.state, r.lead_count,
            )
        except Exception:
            # Mirror fire_agency_audit_alert's pattern: don't let one
            # failed email block the rest of the batch, don't retry.
            logger.exception(
                "home_office_state_digest: SMTP send failed for state=%s count=%d — skipping",
                r.state, r.lead_count,
            )
            continue

    return sent
