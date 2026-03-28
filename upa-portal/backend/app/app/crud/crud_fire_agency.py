#!/usr/bin/env python

"""CRUD operations for the FireAgency model"""

from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.fire_agency import FireAgency
from app.schemas.fire_agency import FireAgencyCreate, FireAgencyUpdate


class CRUDFireAgency(CRUDBase[FireAgency, FireAgencyCreate, FireAgencyUpdate]):
    def get_active(self, db_session: Session) -> Sequence[FireAgency]:
        """
        Retrieve all agencies flagged as active for polling.

        Parameters
        ----------
        db_session : Session
            Database session.

        Returns
        -------
        Sequence[FireAgency]
            List of active FireAgency records.
        """
        with db_session as session:
            stmt = select(FireAgency).where(FireAgency.is_active.is_(True))
            return session.scalars(stmt).all()

    def get_by_agency_id(
        self, db_session: Session, *, agency_id: str
    ) -> FireAgency | None:
        """
        Look up an agency by its PulsePoint agency_id string.

        Parameters
        ----------
        db_session : Session
            Database session.
        agency_id : str
            PulsePoint agency ID.

        Returns
        -------
        FireAgency or None
        """
        with db_session as session:
            stmt = select(FireAgency).where(FireAgency.agency_id == agency_id)
            return session.scalar(stmt)

    def get_next_poll_batch(
        self, db_session: Session, *, batch_size: int = 1000
    ) -> Sequence[FireAgency]:
        """
        Return the next batch of active agencies to poll, ordered by
        least-recently-polled first (never-polled agencies get top priority).

        Parameters
        ----------
        db_session : Session
            Database session.
        batch_size : int
            Maximum number of agencies to return.

        Returns
        -------
        Sequence[FireAgency]
            Batch of agencies ordered by last_polled_at ASC NULLS FIRST.
        """
        with db_session as session:
            stmt = (
                select(FireAgency)
                .where(FireAgency.is_active.is_(True))
                .order_by(FireAgency.last_polled_at.asc().nulls_first())
                .limit(batch_size)
            )
            return session.scalars(stmt).all()

    def update_last_polled(self, db_session: Session, *, agency_uuid: UUID) -> FireAgency | None:
        """
        Stamp the last_polled_at field with the current UTC time.

        Parameters
        ----------
        db_session : Session
            Database session.
        agency_uuid : UUID
            Primary key of the FireAgency to update.

        Returns
        -------
        FireAgency or None
        """
        db_obj = self.get(db_session, obj_id=agency_uuid)
        if db_obj:
            return self.update(
                db_session,
                db_obj=db_obj,
                obj_in={"last_polled_at": datetime.now(timezone.utc)},
            )
        return None


fire_agency = CRUDFireAgency(FireAgency)
