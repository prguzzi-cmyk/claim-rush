#!/usr/bin/env python

"""Business logic for the Lead Rotation Engine."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app import crud
from app.models.lead_distribution import LeadDistributionHistory
from app.models.rotation_lead import RotationLead
from app.models.rotation_lead_activity import RotationLeadActivity
from app.models.territory import Territory, UserTerritory
from app.schemas.rotation_lead import (
    RotationLeadActivityCreate,
    RotationLeadCreate,
)
from app.services.agent_performance import compute_agent_scores

logger = logging.getLogger(__name__)


class RotationLeadService:
    """Orchestrates lead creation, assignment, contact tracking, and reassignment."""

    def __init__(self, db_session: Session):
        self.db = db_session

    # ── Public API ───────────────────────────────────────────────────────

    def create_lead_with_auto_assign(
        self,
        lead_data: RotationLeadCreate,
        created_by_id: UUID | None = None,
    ) -> RotationLead:
        """Create a rotation lead and auto-assign via round-robin.

        Assignment cascade:
        1. Territory match (zip → state) → eligible agents
        2. Fallback: national-queue agents (national_access=True)
        3. Fallback: any active admin

        The lead is ALWAYS created. Assignment is best-effort but every
        reasonable fallback is tried before returning unassigned.
        """
        logger.info(
            "[RotationLead] Creating: source=%s state=%s zip=%s address=%s type=%s",
            lead_data.lead_source,
            lead_data.property_state,
            lead_data.property_zip,
            lead_data.property_address,
            lead_data.incident_type,
        )

        lead = crud.rotation_lead.create(self.db, obj_in=lead_data)

        self._log_activity(
            lead_id=lead.id,
            activity_type="created",
            description=f"Lead created from source '{lead_data.lead_source}'",
            performed_by_id=created_by_id,
        )

        # ── Assignment cascade ────────────────────────────────────

        chosen_agent_id: UUID | None = None
        assignment_source = ""

        # 1. Territory match → eligible agents
        territory = self._find_territory(
            lead_data.property_state, lead_data.property_zip
        )
        if territory:
            agents = self._get_eligible_agents(territory, apply_weighting=True)
            if agents:
                config = crud.rotation_config.get_or_create_for_territory(
                    self.db, territory_id=territory.id
                )
                idx = config.rotation_index % len(agents)
                chosen_agent_id = agents[idx]
                assignment_source = f"territory={territory.id}"
                crud.rotation_config.advance_rotation(
                    self.db, config=config, new_index=idx + 1,
                    agent_id=chosen_agent_id,
                )
            else:
                logger.info(
                    "[RotationLead] No eligible agents for territory %s — trying fallback",
                    territory.id,
                )
        else:
            logger.info(
                "[RotationLead] No territory match for state=%s zip=%s — trying fallback",
                lead_data.property_state,
                lead_data.property_zip,
            )

        # 2. Fallback: national-queue agents
        if chosen_agent_id is None:
            national_agents = self._get_national_queue_agents()
            if national_agents:
                chosen_agent_id = national_agents[0]
                assignment_source = "national_queue"
                logger.info(
                    "[RotationLead] Assigned via national queue: agent=%s",
                    chosen_agent_id,
                )

        # 3. Fallback: any active admin
        if chosen_agent_id is None:
            admin_id = self._get_fallback_admin()
            if admin_id:
                chosen_agent_id = admin_id
                assignment_source = "admin_fallback"
                logger.info(
                    "[RotationLead] Assigned to fallback admin: agent=%s",
                    chosen_agent_id,
                )

        # ── Apply assignment ──────────────────────────────────────

        if chosen_agent_id:
            now = datetime.now(timezone.utc)
            crud.rotation_lead.update(
                self.db,
                db_obj=lead,
                obj_in={
                    "assigned_agent_id": chosen_agent_id,
                    "assignment_date": now,
                    "lead_status": "assigned",
                },
            )

            self._log_activity(
                lead_id=lead.id,
                activity_type="assigned",
                description=f"Auto-assigned to agent {chosen_agent_id} ({assignment_source})",
                new_value=str(chosen_agent_id),
                performed_by_id=created_by_id,
            )

            self._notify_agent_of_assignment(lead, chosen_agent_id)

            logger.info(
                "[RotationLead] Assigned: lead=%s agent=%s source=%s",
                lead.id, chosen_agent_id, assignment_source,
            )
        else:
            logger.warning(
                "[RotationLead] Could not assign agent — no territory agents, "
                "no national queue, no admins. lead=%s state=%s",
                lead.id, lead_data.property_state,
            )

        return lead

    def record_contact_attempt(
        self,
        lead_id: UUID,
        outcome: str,
        notes: str | None,
        user_id: UUID,
    ) -> RotationLead:
        """Record a contact attempt on a lead."""
        lead = crud.rotation_lead.get(self.db, obj_id=lead_id)
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")

        new_count = lead.contact_attempt_count + 1
        now = datetime.now(timezone.utc)

        # Determine status from outcome
        status_map = {
            "no_answer": "no_answer",
            "left_message": "left_message",
            "call_back_later": "call_back_later",
            "not_interested": "not_interested",
            "interested": "interested",
            "signed_client": "signed_client",
            "invalid_lead": "invalid_lead",
        }
        new_status = status_map.get(outcome, "attempted_contact")

        update_data = {
            "contact_attempt_count": new_count,
            "last_contact_attempt": now,
            "lead_status": new_status,
            "outcome": outcome,
        }
        if notes:
            update_data["notes"] = notes

        crud.rotation_lead.update(self.db, db_obj=lead, obj_in=update_data)

        self._log_activity(
            lead_id=lead_id,
            activity_type="contact_attempted",
            description=f"Contact attempt #{new_count}: {outcome}",
            old_value=lead.lead_status,
            new_value=new_status,
            performed_by_id=user_id,
        )

        return lead

    def update_lead_status(
        self,
        lead_id: UUID,
        new_status: str,
        user_id: UUID,
    ) -> RotationLead:
        """Change the status of a lead."""
        lead = crud.rotation_lead.get(self.db, obj_id=lead_id)
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")

        old_status = lead.lead_status
        crud.rotation_lead.update(
            self.db, db_obj=lead, obj_in={"lead_status": new_status}
        )

        self._log_activity(
            lead_id=lead_id,
            activity_type="status_changed",
            description=f"Status changed from {old_status} to {new_status}",
            old_value=old_status,
            new_value=new_status,
            performed_by_id=user_id,
        )

        return lead

    def reassign_lead(
        self,
        lead_id: UUID,
        new_agent_id: UUID | None,
        reason: str | None,
        user_id: UUID,
    ) -> RotationLead:
        """Reassign a lead to a new agent (or auto-pick next in rotation)."""
        lead = crud.rotation_lead.get(self.db, obj_id=lead_id)
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")

        old_agent_id = lead.assigned_agent_id

        if new_agent_id is None:
            # Auto-pick next agent via territory rotation
            territory = self._find_territory(lead.property_state, lead.property_zip)
            if territory:
                agents = self._get_eligible_agents(territory, apply_weighting=True)
                if agents:
                    config = crud.rotation_config.get_or_create_for_territory(
                        self.db, territory_id=territory.id
                    )
                    idx = config.rotation_index % len(agents)
                    new_agent_id = agents[idx]
                    crud.rotation_config.advance_rotation(
                        self.db, config=config, new_index=idx + 1, agent_id=new_agent_id
                    )

        if new_agent_id is None:
            logger.warning("Could not find agent for reassignment of lead %s", lead_id)
            return lead

        now = datetime.now(timezone.utc)
        crud.rotation_lead.update(
            self.db,
            db_obj=lead,
            obj_in={
                "assigned_agent_id": new_agent_id,
                "assignment_date": now,
                "lead_status": "assigned",
                "contact_attempt_count": 0,
                "last_contact_attempt": None,
                "reassignment_count": lead.reassignment_count + 1,
            },
        )

        desc = f"Reassigned from {old_agent_id} to {new_agent_id}"
        if reason:
            desc += f" — {reason}"

        self._log_activity(
            lead_id=lead_id,
            activity_type="reassigned",
            description=desc,
            old_value=str(old_agent_id) if old_agent_id else None,
            new_value=str(new_agent_id),
            performed_by_id=user_id,
        )

        return lead

    def check_timeout_reassignments(self) -> int:
        """Bulk check: reassign leads that are past timeout with 0 contact attempts."""
        # Get global default config for timeout
        global_config = crud.rotation_config.get_or_create_for_territory(
            self.db, territory_id=None
        )
        timeout_hours = global_config.contact_timeout_hours

        if not global_config.auto_reassign_enabled:
            logger.info("Auto-reassign disabled globally, skipping timeout check")
            return 0

        stale_leads = crud.rotation_lead.get_assigned_leads_past_timeout(
            self.db, timeout_hours=timeout_hours
        )

        reassigned = 0
        for lead in stale_leads:
            try:
                self.reassign_lead(
                    lead_id=lead.id,
                    new_agent_id=None,
                    reason="Timeout — no contact attempt within window",
                    user_id=lead.assigned_agent_id,  # attribute to original agent
                )
                reassigned += 1
            except Exception:
                logger.error("Failed to reassign lead %s", lead.id, exc_info=True)

        logger.info("Timeout reassignment check: %d/%d reassigned", reassigned, len(stale_leads))
        return reassigned

    def get_metrics(self) -> dict:
        """Compute aggregated metrics for the rotation lead system."""
        from app.services.agent_performance import _compute_avg_response_hours

        raw = crud.rotation_lead.get_metrics(self.db)

        total = sum(s["count"] for s in raw["status_breakdown"])
        assigned = sum(
            s["count"]
            for s in raw["status_breakdown"]
            if s["status"] != "new_lead"
        )
        signed = sum(
            s["count"]
            for s in raw["status_breakdown"]
            if s["status"] == "signed_client"
        )
        conversion_rate = (signed / total * 100) if total > 0 else 0.0

        # Gather all agent IDs for response-hours computation
        all_agent_ids = [a["agent_id"] for a in raw["agent_breakdown"] if a["agent_id"]]

        # Compute avg response hours per agent
        with self.db as session:
            response_hours_map = _compute_avg_response_hours(session, all_agent_ids) if all_agent_ids else {}

        # Build agent breakdown with user names
        agent_breakdown = []
        for a in raw["agent_breakdown"]:
            with self.db as session:
                from app.models import User
                user = session.get(User, a["agent_id"])
                name = f"{user.first_name} {user.last_name}" if user else str(a["agent_id"])

            # Count signed for this agent
            with self.db as session:
                signed_count = session.scalar(
                    select(func.count(RotationLead.id)).where(
                        and_(
                            RotationLead.assigned_agent_id == a["agent_id"],
                            RotationLead.lead_status == "signed_client",
                            RotationLead.is_removed.is_(False),
                        )
                    )
                ) or 0

            avg_hrs = response_hours_map.get(a["agent_id"])
            agent_breakdown.append({
                "agent_id": a["agent_id"],
                "agent_name": name,
                "leads_assigned": a["total"],
                "leads_contacted": a["contacted"],
                "leads_signed": signed_count,
                "avg_response_hours": round(avg_hrs, 1) if avg_hrs is not None else None,
            })

        # Compute global avg response hours across all agents
        all_hours = [
            ab["avg_response_hours"]
            for ab in agent_breakdown
            if ab["avg_response_hours"] is not None
        ]
        global_avg = round(sum(all_hours) / len(all_hours), 1) if all_hours else None

        return {
            "total_leads": total,
            "assigned_leads": assigned,
            "signed_clients": signed,
            "avg_response_hours": global_avg,
            "agent_breakdown": agent_breakdown,
            "status_breakdown": raw["status_breakdown"],
            "conversion_rate": round(conversion_rate, 2),
        }

    # ── Private Helpers ──────────────────────────────────────────────────

    def _find_territory(self, state: str, zip_code: str) -> Territory | None:
        """Match territory: try zip first, fallback to state."""
        with self.db as session:
            # Try zip match
            territory = session.scalars(
                select(Territory).where(
                    and_(
                        Territory.zip_code == zip_code,
                        Territory.is_active.is_(True),
                    )
                )
            ).first()
            if territory:
                return territory

            # Fallback to state match
            territory = session.scalars(
                select(Territory).where(
                    and_(
                        Territory.state == state,
                        Territory.territory_type == "state",
                        Territory.is_active.is_(True),
                    )
                )
            ).first()
            return territory

    def _get_eligible_agents(
        self, territory: Territory, *, apply_weighting: bool = False,
    ) -> list[UUID]:
        """Get active user IDs for a territory who are accepting leads
        and haven't hit their daily cap.

        When apply_weighting=True and the territory config has
        use_performance_weighting enabled, agents are sorted by
        composite performance score (descending) before return.
        """
        with self.db as session:
            from app.models import User

            stmt = (
                select(User)
                .join(UserTerritory, UserTerritory.user_id == User.id)
                .where(
                    and_(
                        UserTerritory.territory_id == territory.id,
                        User.is_active.is_(True),
                        User.is_accepting_leads.is_(True),
                    )
                )
                .order_by(UserTerritory.user_id)
            )
            candidates = list(session.scalars(stmt).all())

            eligible: list[User] = []
            today_start = datetime.combine(
                datetime.now(timezone.utc).date(),
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            for agent in candidates:
                if agent.daily_lead_limit is not None:
                    assigned_today = session.scalar(
                        select(func.count(LeadDistributionHistory.id)).where(
                            LeadDistributionHistory.assigned_agent_id == agent.id,
                            LeadDistributionHistory.distributed_at >= today_start,
                        )
                    ) or 0
                    if assigned_today >= agent.daily_lead_limit:
                        logger.debug(
                            "Agent %s skipped — daily cap reached (%d/%d)",
                            agent.id, assigned_today, agent.daily_lead_limit,
                        )
                        continue
                eligible.append(agent)

            # Apply performance weighting if requested
            if apply_weighting and len(eligible) > 1:
                config = crud.rotation_config.get_by_territory(
                    self.db, territory_id=territory.id
                )
                if config and config.use_performance_weighting:
                    agent_ids = [a.id for a in eligible]
                    scores = compute_agent_scores(
                        session,
                        agent_ids,
                        weight_closing_rate=config.weight_closing_rate,
                        weight_response_speed=config.weight_response_speed,
                        weight_satisfaction=config.weight_satisfaction,
                    )
                    eligible.sort(
                        key=lambda a: scores[a.id].composite_score
                        if a.id in scores else 0.0,
                        reverse=True,
                    )
                    logger.debug(
                        "Performance-weighted order: %s",
                        [(a.id, scores.get(a.id, None)) for a in eligible],
                    )

            return [a.id for a in eligible]

    def _get_national_queue_agents(self) -> list[UUID]:
        """Return agent IDs with national_access who are active + accepting leads."""
        with self.db as session:
            from app.models import User

            stmt = (
                select(User.id)
                .where(
                    User.national_access == True,
                    User.is_active == True,
                    User.is_accepting_leads == True,
                )
                .order_by(User.created_at.asc())
            )
            return list(session.scalars(stmt).all())

    def _get_fallback_admin(self) -> UUID | None:
        """Return the first active admin/super-admin as last-resort fallback."""
        with self.db as session:
            from app.models import User
            from app.models.role import Role

            stmt = (
                select(User.id)
                .join(Role, User.role_id == Role.id)
                .where(
                    User.is_active == True,
                    Role.name.in_(("admin", "super-admin")),
                )
                .order_by(User.created_at.asc())
                .limit(1)
            )
            return session.scalar(stmt)

    def _notify_agent_of_assignment(self, lead: RotationLead, agent_id: UUID) -> None:
        """Send in-app notification to the assigned agent."""
        try:
            from app.utils.notifications import create_notification

            address = f"{lead.property_address}, {lead.property_city}, {lead.property_state} {lead.property_zip}"
            source_label = (lead.lead_source or "rotation").replace("_", " ").title()

            create_notification(
                self.db,
                user_id=agent_id,
                title=f"New Rotation Lead – {source_label}",
                message=(
                    f"A new {source_label} lead has been assigned to you.\n"
                    f"Owner: {lead.owner_name}\n"
                    f"Address: {address}"
                ),
                link=f"/#/app/rotation-leads/{lead.id}",
                notification_type="lead_assignment",
            )
        except Exception:
            logger.warning("Failed to send notification for rotation lead %s", lead.id, exc_info=True)

    def _log_activity(
        self,
        *,
        lead_id: UUID,
        activity_type: str,
        description: str,
        old_value: str | None = None,
        new_value: str | None = None,
        performed_by_id: UUID | None = None,
    ) -> RotationLeadActivity:
        """Create an immutable activity record."""
        activity_in = RotationLeadActivityCreate(
            rotation_lead_id=lead_id,
            activity_type=activity_type,
            description=description,
            old_value=old_value,
            new_value=new_value,
            performed_by_id=performed_by_id,
        )
        return crud.rotation_lead_activity.create(self.db, obj_in=activity_in)
