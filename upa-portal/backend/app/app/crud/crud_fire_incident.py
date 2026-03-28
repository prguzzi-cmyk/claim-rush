#!/usr/bin/env python

"""CRUD operations for the FireIncident model.

Retention policy
----------------
Incidents are NEVER deleted or hidden by aging.  The ``dispatch_status`` field
tracks lifecycle (active → cleared → archived) but all records are preserved
permanently for historical analysis.

The 24h live-view is a pure *timestamp* filter on ``received_at`` — it does
**not** use ``dispatch_status`` or ``is_active``.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.orm import Session

from app.core.log import logger
from app.crud.base import CRUDBase
from app.models.fire_incident import (
    DISPATCH_STATUS_ACTIVE,
    DISPATCH_STATUS_CLEARED,
    FireIncident,
)
from app.schemas.fire_incident import FireIncidentCreate, FireIncidentUpdate
from app.utils.pulsepoint import get_call_type_description
from app.utils.source_router import get_source_id


class CRUDFireIncident(CRUDBase[FireIncident, FireIncidentCreate, FireIncidentUpdate]):
    # ── Live-view queries ──────────────────────────────────────────

    def get_recent(
        self,
        db_session: Session,
        *,
        hours: int = 24,
    ) -> Sequence[FireIncident]:
        """Return ALL fire incidents from the last *hours*, ordered by
        received_at DESC.

        This is a pure timestamp query — dispatch_status and is_active are
        irrelevant.  Cleared and active incidents both appear.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        with db_session as session:
            stmt = (
                select(FireIncident)
                .where(FireIncident.received_at >= cutoff)
                .order_by(FireIncident.received_at.desc())
            )
            return list(session.scalars(stmt).all())

    # Backward-compat alias used by potential_claims and other callers
    get_recent_active = get_recent

    def get_by_pulsepoint_id(
        self, db_session: Session, *, pulsepoint_id: str, agency_id: UUID
    ) -> FireIncident | None:
        """
        Look up a specific incident by its PulsePoint ID and agency.

        Parameters
        ----------
        db_session : Session
            Database session.
        pulsepoint_id : str
            PulsePoint incident ID.
        agency_id : UUID
            Parent agency UUID.

        Returns
        -------
        FireIncident or None
        """
        with db_session as session:
            stmt = select(FireIncident).where(
                and_(
                    FireIncident.pulsepoint_id == pulsepoint_id,
                    FireIncident.agency_id == agency_id,
                )
            )
            return session.scalar(stmt)

    def get_by_external_id(
        self, db_session: Session, *, external_id: str, data_source: str
    ) -> FireIncident | None:
        """
        Look up an incident by its external_id and data_source.

        Parameters
        ----------
        db_session : Session
            Database session.
        external_id : str
            External identifier unique within the data source.
        data_source : str
            Source identifier (pulsepoint, socrata, nifc, firms).

        Returns
        -------
        FireIncident or None
        """
        with db_session as session:
            stmt = select(FireIncident).where(
                and_(
                    FireIncident.external_id == external_id,
                    FireIncident.data_source == data_source,
                )
            )
            return session.scalar(stmt)

    # ── Dispatch status transitions ──────────────────────────────

    def mark_cleared_pulsepoint(
        self,
        db_session: Session,
        agency_id: UUID,
        active_pulsepoint_ids: set[str],
    ) -> int:
        """Transition PulsePoint incidents to ``cleared`` when they drop out of
        the active dispatch response.

        The record is **never deleted** — only ``dispatch_status`` and
        ``cleared_at`` are updated.  ``is_active`` is kept in sync for
        backward compatibility.
        """
        now = datetime.now(timezone.utc)
        with db_session as session:
            conditions = [
                FireIncident.agency_id == agency_id,
                FireIncident.data_source == "pulsepoint",
                FireIncident.dispatch_status == DISPATCH_STATUS_ACTIVE,
            ]
            if active_pulsepoint_ids:
                conditions.append(
                    FireIncident.pulsepoint_id.notin_(active_pulsepoint_ids)
                )

            stmt = (
                update(FireIncident)
                .where(and_(*conditions))
                .values(
                    dispatch_status=DISPATCH_STATUS_CLEARED,
                    is_active=False,
                    cleared_at=now,
                )
            )
            result = session.execute(stmt)
            session.commit()
            cleared = result.rowcount
            if cleared:
                logger.info(
                    f"[PulsePoint] Marked {cleared} incidents as cleared "
                    f"for agency {agency_id}."
                )
            return cleared

    def mark_cleared_external(
        self,
        db_session: Session,
        data_source: str,
        active_external_ids: set[str],
    ) -> int:
        """Transition external-source incidents to ``cleared`` when they drop
        out of the source API response.

        The record is **never deleted**.
        """
        now = datetime.now(timezone.utc)
        with db_session as session:
            conditions = [
                FireIncident.data_source == data_source,
                FireIncident.dispatch_status == DISPATCH_STATUS_ACTIVE,
            ]
            if active_external_ids:
                conditions.append(
                    FireIncident.external_id.notin_(active_external_ids)
                )

            stmt = (
                update(FireIncident)
                .where(and_(*conditions))
                .values(
                    dispatch_status=DISPATCH_STATUS_CLEARED,
                    is_active=False,
                    cleared_at=now,
                )
            )
            result = session.execute(stmt)
            session.commit()
            cleared = result.rowcount
            if cleared:
                logger.info(
                    f"[{data_source}] Marked {cleared} incidents as cleared."
                )
            return cleared

    def upsert_from_external(
        self,
        db_session: Session,
        incidents_list: list[dict],
        data_source: str,
    ) -> int:
        """
        Generic upsert for normalized incident dicts from any external source.

        Each dict must contain at minimum: external_id, call_type.
        Optional: call_type_description, address, latitude, longitude, received_at, source_url.

        Deduplicates on (data_source, external_id).

        Parameters
        ----------
        db_session : Session
            Database session.
        incidents_list : list[dict]
            Normalized incident dicts from any source client.
        data_source : str
            Source identifier (socrata, nifc, firms).

        Returns
        -------
        int
            Number of incidents processed (inserted + updated).
        """
        if not incidents_list:
            return 0

        count = 0
        inserted = 0
        updated = 0
        active_external_ids: set[str] = set()
        for item in incidents_list:
            try:
                external_id = item.get("external_id", "")
                if not external_id:
                    continue

                active_external_ids.add(external_id)

                existing = self.get_by_external_id(
                    db_session,
                    external_id=external_id,
                    data_source=data_source,
                )

                source_id = get_source_id(data_source)

                # Ensure received_at is timezone-aware
                received_at = item.get("received_at")
                if received_at and hasattr(received_at, "tzinfo") and received_at.tzinfo is None:
                    received_at = received_at.replace(tzinfo=timezone.utc)

                update_data = {
                    "call_type": item.get("call_type", ""),
                    "call_type_description": item.get("call_type_description"),
                    "address": item.get("address"),
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "received_at": received_at,
                    "dispatch_status": DISPATCH_STATUS_ACTIVE,
                    "is_active": True,
                    "source_url": item.get("source_url"),
                }
                if source_id:
                    update_data["source_id"] = source_id

                if existing:
                    self.update(db_session, db_obj=existing, obj_in=update_data)
                    updated += 1
                else:
                    create_data = FireIncidentCreate(
                        call_type=item.get("call_type", ""),
                        call_type_description=item.get("call_type_description"),
                        address=item.get("address"),
                        latitude=item.get("latitude"),
                        longitude=item.get("longitude"),
                        received_at=received_at,
                        dispatch_status=DISPATCH_STATUS_ACTIVE,
                        is_active=True,
                        data_source=data_source,
                        external_id=external_id,
                        source_url=item.get("source_url"),
                        agency_id=None,
                    )
                    obj = self.create(db_session, obj_in=create_data)
                    if source_id and obj:
                        obj.source_id = source_id
                        db_session.add(obj)
                        db_session.commit()
                    inserted += 1

                count += 1
            except Exception as exc:
                logger.error(f"[{data_source}] Error upserting incident {item}: {exc}")

        # Mark incidents no longer in the source response as "cleared"
        # (record is preserved permanently — only status changes)
        cleared = 0
        if active_external_ids:
            cleared = self.mark_cleared_external(
                db_session, data_source=data_source, active_external_ids=active_external_ids
            )

        logger.info(
            f"[{data_source}] Upsert complete: "
            f"fetched={len(incidents_list)} processed={count} "
            f"inserted={inserted} updated={updated} "
            f"cleared={cleared}"
        )

        return count

    def upsert_from_pulsepoint(
        self,
        db_session: Session,
        agency_uuid: UUID,
        incidents_list: list[dict],
    ) -> tuple[int, list[UUID]]:
        """
        Insert or update a batch of raw PulsePoint incident dicts.

        Existing incidents (matched by pulsepoint_id + agency_id) are updated
        in-place; new ones are inserted.  Incidents within the 24h window are
        never deactivated so they remain visible in the Fire view.
        """
        if not incidents_list:
            return 0, []

        count = 0
        inserted = 0
        updated = 0
        new_ids: list[UUID] = []
        active_pulsepoint_ids: set[str] = set()
        for raw in incidents_list:
            try:
                pulsepoint_id: str = raw.get("ID", "")
                if not pulsepoint_id:
                    continue

                active_pulsepoint_ids.add(pulsepoint_id)

                call_type: str = raw.get("PulsePointIncidentCallType", "")
                address: str | None = raw.get("FullDisplayAddress")
                received_at_str: str | None = raw.get("CallReceivedDateTime")
                lat = raw.get("Latitude")
                lon = raw.get("Longitude")
                units_raw = raw.get("Unit", [])
                units_json = json.dumps(
                    [u.get("UnitID") for u in units_raw if u.get("UnitID")]
                )

                # Parse received_at — ensure timezone-aware (UTC)
                received_at = None
                if received_at_str:
                    try:
                        received_at = datetime.fromisoformat(
                            received_at_str.replace("Z", "+00:00")
                        )
                        # If the source returned a naive datetime, assume UTC
                        if received_at.tzinfo is None:
                            received_at = received_at.replace(tzinfo=timezone.utc)
                    except ValueError:
                        logger.warning(
                            f"[PulsePoint] Could not parse received_at: {received_at_str!r}"
                        )

                existing = self.get_by_pulsepoint_id(
                    db_session,
                    pulsepoint_id=pulsepoint_id,
                    agency_id=agency_uuid,
                )

                pp_source_id = get_source_id("pulsepoint")

                update_data = {
                    "call_type": call_type,
                    "call_type_description": get_call_type_description(call_type),
                    "address": address,
                    "latitude": float(lat) if lat is not None else None,
                    "longitude": float(lon) if lon is not None else None,
                    "received_at": received_at,
                    "units": units_json,
                    "dispatch_status": DISPATCH_STATUS_ACTIVE,
                    "is_active": True,
                }
                if pp_source_id:
                    update_data["source_id"] = pp_source_id

                if existing:
                    self.update(db_session, db_obj=existing, obj_in=update_data)
                    updated += 1
                else:
                    create_data = FireIncidentCreate(
                        pulsepoint_id=pulsepoint_id,
                        agency_id=agency_uuid,
                        call_type=call_type,
                        call_type_description=get_call_type_description(call_type),
                        address=address,
                        latitude=float(lat) if lat is not None else None,
                        longitude=float(lon) if lon is not None else None,
                        received_at=received_at,
                        units=units_json,
                        dispatch_status=DISPATCH_STATUS_ACTIVE,
                        is_active=True,
                        data_source="pulsepoint",
                        external_id=pulsepoint_id,
                    )
                    obj = self.create(db_session, obj_in=create_data)
                    if obj:
                        new_ids.append(obj.id)
                    if pp_source_id and obj:
                        obj.source_id = pp_source_id
                        db_session.add(obj)
                        db_session.commit()
                    inserted += 1

                count += 1
            except Exception as exc:
                logger.error(f"[PulsePoint] Error upserting incident {raw}: {exc}")

        # Mark incidents no longer in the dispatch response as "cleared"
        # (record is preserved permanently — only status changes)
        cleared = 0
        if active_pulsepoint_ids:
            cleared = self.mark_cleared_pulsepoint(
                db_session, agency_id=agency_uuid, active_pulsepoint_ids=active_pulsepoint_ids
            )

        logger.info(
            f"[PulsePoint] Agency {agency_uuid}: "
            f"fetched={len(incidents_list)} processed={count} "
            f"inserted={inserted} updated={updated} "
            f"cleared={cleared}"
        )

        return count, new_ids


fire_incident = CRUDFireIncident(FireIncident)
