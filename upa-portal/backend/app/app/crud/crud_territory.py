#!/usr/bin/env python

"""CRUD operations for the Territory and UserTerritory models"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, select, delete
from sqlalchemy.orm import Session, selectinload, joinedload

from app.crud.base import CRUDBase
from app.models.territory import Territory, UserTerritory
from app.schemas.territory import TerritoryCreate, TerritoryUpdate


class CRUDTerritory(CRUDBase[Territory, TerritoryCreate, TerritoryUpdate]):

    def get_active(self, db_session: Session) -> Sequence[Territory]:
        """Return all active territories."""
        with db_session as session:
            stmt = (
                select(Territory)
                .where(Territory.is_active.is_(True))
                .order_by(Territory.territory_type, Territory.name)
            )
            return session.scalars(stmt).all()

    def get_by_type(
        self, db_session: Session, *, territory_type: str
    ) -> Sequence[Territory]:
        """Return active territories of a specific type."""
        with db_session as session:
            stmt = (
                select(Territory)
                .where(
                    and_(
                        Territory.territory_type == territory_type,
                        Territory.is_active.is_(True),
                    )
                )
                .order_by(Territory.name)
            )
            return session.scalars(stmt).all()

    def assign_to_user(
        self,
        db_session: Session,
        *,
        user_id: UUID,
        territory_ids: list[UUID],
    ) -> list[UserTerritory]:
        """Assign one or more territories to a user. Skips duplicates."""
        created = []
        with db_session as session:
            for tid in territory_ids:
                # Check if assignment already exists
                existing = session.scalar(
                    select(UserTerritory).where(
                        and_(
                            UserTerritory.user_id == user_id,
                            UserTerritory.territory_id == tid,
                        )
                    )
                )
                if existing:
                    continue

                ut = UserTerritory(user_id=user_id, territory_id=tid)
                session.add(ut)
                created.append(ut)

            session.commit()
            for ut in created:
                session.refresh(ut)

        return created

    def remove_from_user(
        self,
        db_session: Session,
        *,
        user_id: UUID,
        territory_ids: list[UUID],
    ) -> int:
        """Remove territory assignments from a user. Returns count of removed."""
        with db_session as session:
            stmt = delete(UserTerritory).where(
                and_(
                    UserTerritory.user_id == user_id,
                    UserTerritory.territory_id.in_(territory_ids),
                )
            )
            result = session.execute(stmt)
            session.commit()
            return result.rowcount

    def get_user_territories(
        self, db_session: Session, *, user_id: UUID
    ) -> Sequence[Territory]:
        """Get all active territories assigned to a user."""
        with db_session as session:
            stmt = (
                select(Territory)
                .join(UserTerritory, UserTerritory.territory_id == Territory.id)
                .where(
                    and_(
                        UserTerritory.user_id == user_id,
                        Territory.is_active.is_(True),
                    )
                )
                .order_by(Territory.territory_type, Territory.name)
            )
            return session.scalars(stmt).all()

    def get_user_territory_assignments(
        self, db_session: Session, *, user_id: UUID
    ) -> Sequence[UserTerritory]:
        """Get all UserTerritory records for a user."""
        with db_session as session:
            stmt = (
                select(UserTerritory)
                .where(UserTerritory.user_id == user_id)
                .order_by(UserTerritory.created_at)
            )
            return session.scalars(stmt).all()

    def get_all_with_assignments(self, db_session: Session) -> Sequence[Territory]:
        """Return all territories (active + inactive) with assigned user info."""
        with db_session as session:
            stmt = (
                select(Territory)
                .options(
                    selectinload(Territory.user_territories)
                    .joinedload(UserTerritory.user),
                    joinedload(Territory.chapter_president),
                )
                .order_by(Territory.territory_type, Territory.name)
            )
            return session.scalars(stmt).unique().all()


territory = CRUDTerritory(Territory)
