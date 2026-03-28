#!/usr/bin/env python

"""Territory-based data filtering utility.

Resolves a user's assigned territories into SQLAlchemy WHERE clauses
that can be injected into any data query. This is the central entry
point for territory-based access control across all modules.
"""

import json
import logging
from typing import Any

from sqlalchemy import or_, and_, select
from sqlalchemy.orm import Session

from app.models.territory import Territory, UserTerritory
from app.models.user import User

logger = logging.getLogger(__name__)


def get_user_territories(db_session: Session, user: User) -> list[Territory]:
    """Fetch active territories assigned to the given user."""
    stmt = (
        select(Territory)
        .join(UserTerritory, UserTerritory.territory_id == Territory.id)
        .where(
            and_(
                UserTerritory.user_id == user.id,
                Territory.is_active.is_(True),
            )
        )
    )
    return list(db_session.scalars(stmt).all())


def user_has_territory_bypass(user: User) -> bool:
    """Check if a user should bypass territory filtering.

    Returns True for national_access users or admin-level users.
    """
    if getattr(user, "national_access", False):
        return True
    return False


def build_territory_filters_for_model(
    territories: list[Territory],
    *,
    state_column: Any = None,
    county_column: Any = None,
    zip_column: Any = None,
    zip_is_json: bool = False,
) -> list:
    """Build SQLAlchemy filter clauses from a list of territories.

    Parameters
    ----------
    territories : list[Territory]
        The user's assigned territories
    state_column : Column | None
        The model column holding the state value (e.g. StormEvent.state)
    county_column : Column | None
        The model column holding the county value (e.g. StormEvent.county)
    zip_column : Column | None
        The model column holding the zip value (e.g. Client.zip_code)
    zip_is_json : bool
        If True, the zip column contains a JSON-encoded array of zip codes
        (e.g. StormEvent.zip_codes) — use LIKE matching instead of equality.

    Returns
    -------
    list
        A list with a single OR clause combining all territory conditions,
        or an empty list if no territories / no matching columns.
    """
    if not territories:
        return []

    conditions = []

    for t in territories:
        if t.territory_type == "state" and state_column is not None and t.state:
            conditions.append(state_column == t.state)

        elif t.territory_type == "county" and t.state and t.county:
            parts = []
            if state_column is not None:
                parts.append(state_column == t.state)
            if county_column is not None:
                parts.append(county_column.ilike(f"%{t.county}%"))
            if parts:
                conditions.append(and_(*parts) if len(parts) > 1 else parts[0])

        elif t.territory_type == "zip" and t.zip_code:
            if zip_column is not None:
                if zip_is_json:
                    # zip_codes is a JSON text column — use LIKE for containment
                    conditions.append(zip_column.ilike(f"%{t.zip_code}%"))
                else:
                    conditions.append(zip_column == t.zip_code)

        elif t.territory_type == "custom":
            # Custom geometry territories — for now, if they have a state,
            # fall back to state filtering. Full geometry support can be added later.
            if state_column is not None and t.state:
                conditions.append(state_column == t.state)

    if not conditions:
        return []

    # Combine all territory conditions with OR — user can see data in ANY of their territories
    return [or_(*conditions)]


# ─────────────────────────────────────────────────────────
# Module-specific filter builders
# ─────────────────────────────────────────────────────────

def get_storm_event_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the StormEvent model."""
    from app.models.storm_event import StormEvent

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    return build_territory_filters_for_model(
        territories,
        state_column=StormEvent.state,
        county_column=StormEvent.county,
        zip_column=StormEvent.zip_codes,
        zip_is_json=True,
    )


def get_fire_incident_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the FireIncident model.

    Filters exclusively through ``fire_agency.state`` and
    ``fire_agency.name``.  PulsePoint FullDisplayAddress is a local street
    address without state/county/zip and must NOT be used for territory
    matching.
    """
    from app.models.fire_agency import FireAgency
    from app.models.fire_incident import FireIncident

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    conditions = []
    for t in territories:
        if t.territory_type == "state" and t.state:
            conditions.append(
                FireIncident.agency.has(FireAgency.state == t.state)
            )
        elif t.territory_type == "county" and t.county:
            conditions.append(
                FireIncident.agency.has(FireAgency.name.ilike(f"%{t.county}%"))
            )
        elif t.territory_type == "zip" and t.zip_code:
            # Zip-level filtering not possible via agency — skip to avoid
            # silently hiding all incidents.
            continue
        elif t.territory_type == "custom" and t.state:
            conditions.append(
                FireIncident.agency.has(FireAgency.state == t.state)
            )

    if not conditions:
        return []

    return [or_(*conditions)]


def get_lead_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the Lead model via LeadContact."""
    from app.models.lead_contact import LeadContact

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    return build_territory_filters_for_model(
        territories,
        state_column=LeadContact.state_loss,
        county_column=None,
        zip_column=LeadContact.zip_code_loss,
    )


def get_client_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the Client model."""
    from app.models.client import Client

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    return build_territory_filters_for_model(
        territories,
        state_column=Client.state,
        county_column=None,
        zip_column=Client.zip_code,
    )


def get_claim_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the Claim model via ClaimContact."""
    from app.models.claim_contact import ClaimContact

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    return build_territory_filters_for_model(
        territories,
        state_column=ClaimContact.state_loss,
        county_column=None,
        zip_column=ClaimContact.zip_code_loss,
    )


def get_roof_analysis_territory_filters(
    db_session: Session, user: User
) -> list:
    """Build territory filters for the RoofAnalysis model."""
    from app.models.roof_analysis import RoofAnalysis

    if user_has_territory_bypass(user):
        return []

    territories = get_user_territories(db_session, user)
    if not territories:
        return []

    return build_territory_filters_for_model(
        territories,
        state_column=RoofAnalysis.state,
        county_column=RoofAnalysis.county,
        zip_column=RoofAnalysis.zip_code,
    )
