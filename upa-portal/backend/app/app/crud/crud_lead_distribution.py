#!/usr/bin/env python

"""CRUD operations for lead distribution"""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lead_distribution import LeadDistributionHistory, TerritoryRotationState
from app.schemas.lead_distribution import (
    LeadDistributionHistoryCreate,
    LeadDistributionHistoryBase,
)


class CRUDLeadDistributionHistory(
    CRUDBase[LeadDistributionHistory, LeadDistributionHistoryCreate, LeadDistributionHistoryBase]
):
    def get_by_lead(self, db_session: Session, *, lead_id: UUID) -> list[LeadDistributionHistory]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.lead_id == lead_id)
                .order_by(self.model.distributed_at.desc())
            )
            return list(session.execute(stmt).scalars().all())

    def get_by_territory(
        self, db_session: Session, *, territory_id: UUID, lead_type: str | None = None
    ) -> list[LeadDistributionHistory]:
        with db_session as session:
            stmt = (
                select(self.model)
                .where(self.model.territory_id == territory_id)
            )
            if lead_type:
                stmt = stmt.where(self.model.lead_type == lead_type)
            stmt = stmt.order_by(self.model.distributed_at.desc())
            return list(session.execute(stmt).scalars().all())

    def count_fire_distributions_for_agent(
        self, db_session: Session, *, territory_id: UUID, agent_id: UUID
    ) -> int:
        with db_session as session:
            stmt = (
                select(func.count())
                .select_from(self.model)
                .where(
                    self.model.territory_id == territory_id,
                    self.model.assigned_agent_id == agent_id,
                    self.model.lead_type == "fire",
                )
            )
            return session.execute(stmt).scalar() or 0

    def get_fire_lead_summary(
        self,
        db_session: Session,
        *,
        start_date=None,
        end_date=None,
    ) -> dict:
        """Aggregate fire lead distribution summary for dashboard."""
        from app.models.fire_incident import FireIncident

        with db_session as session:
            # Total fire incidents in date range
            incident_q = select(func.count()).select_from(FireIncident)
            if start_date:
                incident_q = incident_q.where(FireIncident.created_at >= start_date)
            if end_date:
                incident_q = incident_q.where(FireIncident.created_at <= end_date)
            total_incidents = session.execute(incident_q).scalar() or 0

            # Auto-converted (auto_lead_attempted = True AND lead_id IS NOT NULL)
            converted_q = select(func.count()).select_from(FireIncident).where(
                FireIncident.auto_lead_attempted.is_(True),
                FireIncident.lead_id.isnot(None),
            )
            if start_date:
                converted_q = converted_q.where(FireIncident.created_at >= start_date)
            if end_date:
                converted_q = converted_q.where(FireIncident.created_at <= end_date)
            auto_converted = session.execute(converted_q).scalar() or 0

            # Assigned (fire leads with distribution history)
            assigned_q = (
                select(func.count(func.distinct(self.model.lead_id)))
                .select_from(self.model)
                .where(self.model.lead_type == "fire")
            )
            if start_date:
                assigned_q = assigned_q.where(self.model.distributed_at >= start_date)
            if end_date:
                assigned_q = assigned_q.where(self.model.distributed_at <= end_date)
            assigned = session.execute(assigned_q).scalar() or 0

            # Skip reasons
            skip_q = (
                select(
                    FireIncident.auto_lead_skipped_reason,
                    func.count().label("cnt"),
                )
                .where(
                    FireIncident.auto_lead_skipped_reason.isnot(None),
                )
                .group_by(FireIncident.auto_lead_skipped_reason)
            )
            if start_date:
                skip_q = skip_q.where(FireIncident.created_at >= start_date)
            if end_date:
                skip_q = skip_q.where(FireIncident.created_at <= end_date)
            skip_reasons = {
                row[0]: row[1] for row in session.execute(skip_q).all()
            }

            return {
                "total_incidents": total_incidents,
                "auto_converted": auto_converted,
                "assigned": assigned,
                "unassigned": auto_converted - assigned,
                "skip_reasons": skip_reasons,
            }

    def get_fire_agent_performance(
        self,
        db_session: Session,
        *,
        start_date=None,
        end_date=None,
    ) -> list[dict]:
        """Per-agent fire lead distribution metrics."""
        from app.models.user import User

        with db_session as session:
            stmt = (
                select(
                    self.model.assigned_agent_id,
                    func.count().label("leads_assigned"),
                    func.max(self.model.distributed_at).label("last_assigned_at"),
                )
                .where(self.model.lead_type == "fire")
                .group_by(self.model.assigned_agent_id)
            )
            if start_date:
                stmt = stmt.where(self.model.distributed_at >= start_date)
            if end_date:
                stmt = stmt.where(self.model.distributed_at <= end_date)

            rows = session.execute(stmt).all()
            results = []
            for row in rows:
                agent = session.get(User, row.assigned_agent_id)
                agent_name = (
                    f"{agent.first_name} {agent.last_name}" if agent else "Unknown"
                )

                # Get rotation position
                rot = session.execute(
                    select(TerritoryRotationState).where(
                        TerritoryRotationState.last_assigned_agent_id == row.assigned_agent_id,
                    )
                ).scalar_one_or_none()

                results.append({
                    "agent_id": str(row.assigned_agent_id),
                    "agent_name": agent_name,
                    "leads_assigned": row.leads_assigned,
                    "last_assigned_at": row.last_assigned_at.isoformat() if row.last_assigned_at else None,
                    "rotation_index": rot.rotation_index if rot else None,
                })
            return results

    def get_fire_territory_breakdown(
        self,
        db_session: Session,
        *,
        start_date=None,
        end_date=None,
    ) -> list[dict]:
        """Per-territory fire lead distribution breakdown."""
        from app.models.territory import Territory, UserTerritory
        from app.models.user import User

        with db_session as session:
            stmt = (
                select(
                    self.model.territory_id,
                    func.count().label("total_leads"),
                )
                .where(self.model.lead_type == "fire")
                .group_by(self.model.territory_id)
            )
            if start_date:
                stmt = stmt.where(self.model.distributed_at >= start_date)
            if end_date:
                stmt = stmt.where(self.model.distributed_at <= end_date)

            rows = session.execute(stmt).all()
            results = []
            for row in rows:
                territory = session.get(Territory, row.territory_id)
                territory_name = territory.name if territory else "Unknown"

                # Count active agents in this territory
                agent_count = session.execute(
                    select(func.count())
                    .select_from(UserTerritory)
                    .join(User, User.id == UserTerritory.user_id)
                    .where(
                        UserTerritory.territory_id == row.territory_id,
                        User.is_active == True,
                    )
                ).scalar() or 0

                results.append({
                    "territory_id": str(row.territory_id),
                    "territory_name": territory_name,
                    "total_leads": row.total_leads,
                    "active_agents": agent_count,
                })
            return results


class CRUDTerritoryRotationState:
    def get_or_create(
        self, db_session: Session, *, territory_id: UUID
    ) -> TerritoryRotationState:
        stmt = select(TerritoryRotationState).where(
            TerritoryRotationState.territory_id == territory_id
        )
        state = db_session.execute(stmt).scalar_one_or_none()
        if not state:
            state = TerritoryRotationState(
                territory_id=territory_id,
                rotation_index=0,
            )
            db_session.add(state)
            db_session.flush()
        return state

    def advance(
        self, db_session: Session, *, territory_id: UUID, agent_id: UUID, new_index: int
    ) -> TerritoryRotationState:
        state = self.get_or_create(db_session, territory_id=territory_id)
        state.last_assigned_agent_id = agent_id
        state.rotation_index = new_index
        db_session.add(state)
        db_session.flush()
        return state


lead_distribution_history = CRUDLeadDistributionHistory(LeadDistributionHistory)
territory_rotation_state = CRUDTerritoryRotationState()
