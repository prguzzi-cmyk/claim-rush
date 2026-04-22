#!/usr/bin/env python

"""Agent profile service — CRUD + agent_number generation.

agent_number generation uses per-prefix Postgres sequences provisioned in
migration c0mm155ag02. The role→prefix map is case-insensitive and covers
both the uppercase commission-engine roles (AGENT/RVP/CP/ADMIN) and the
lowercase pre-existing app roles (agent/admin/super-admin) for defensive
resolution — the duplicate-role situation in the role table is a
pre-existing issue we don't solve here.

Every agent_profile insert must call _generate_agent_number() BEFORE adding
to the session, otherwise the NOT NULL agent_number column will reject it.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import AgentBanking, AgentLicense, AgentProfile, File, Role, User
from app.models.user_personal_file import UserPersonalFile


# ─── role.name → agent_number prefix ────────────────────────────────────────

_ROLE_PREFIX_MAP: dict[str, str] = {
    # Commission-engine canonical roles (UPPERCASE from my seed)
    "AGENT": "WA",
    "RVP": "RVP",
    "CP": "CP",
    "ADMIN": "ADM",
    # Pre-existing app roles (lowercase, created by role_permission_sync)
    "agent": "WA",
    "rvp": "RVP",
    "cp": "CP",
    "admin": "ADM",
    "super-admin": "ADM",
    # Everything else → GEN
}

_VALID_PREFIXES = {"WA", "RVP", "CP", "ADM", "GEN"}


def _role_to_prefix(role_name: str | None) -> str:
    """Map a role name to an agent_number prefix. Case-insensitive fallback
    to the uppercase canonical form if the raw name isn't in the map.
    """
    if not role_name:
        return "GEN"
    # Direct match first (preserves exact-case mapping)
    if role_name in _ROLE_PREFIX_MAP:
        return _ROLE_PREFIX_MAP[role_name]
    # Case-insensitive uppercase lookup
    upper = role_name.upper()
    if upper in _ROLE_PREFIX_MAP:
        return _ROLE_PREFIX_MAP[upper]
    return "GEN"


class AgentService:
    """Thin service — all methods take (db, …) and return models or dicts."""

    # ─── agent_number generation ──────────────────────────────────────────

    def _generate_agent_number(self, db: Session, role_name: str | None) -> str:
        """Reserve the next agent_number for a role's prefix.

        Atomically advances the matching Postgres sequence (provisioned in
        migration c0mm155ag02) and formats as f"{PREFIX}-{n:04d}". Safe to
        call concurrently — sequence increments are not subject to
        transaction rollback, so even a failed insert never reuses the number.
        """
        prefix = _role_to_prefix(role_name)
        seq_name = f"agent_number_seq_{prefix.lower()}"
        n = db.execute(text(f"SELECT nextval('{seq_name}')")).scalar()
        return f"{prefix}-{int(n):04d}"

    # ─── Profile CRUD ─────────────────────────────────────────────────────

    def list_profiles(self, db: Session) -> list[dict[str, Any]]:
        rows = db.execute(
            select(AgentProfile).order_by(AgentProfile.agent_number)
        ).scalars().all()
        return [self._profile_to_dto(db, p) for p in rows]

    def get_profile_by_id(self, db: Session, profile_id: UUID) -> dict[str, Any] | None:
        p = db.get(AgentProfile, profile_id)
        return self._profile_to_dto(db, p) if p else None

    def get_profile_by_user_id(self, db: Session, user_id: UUID) -> dict[str, Any] | None:
        p = db.execute(
            select(AgentProfile).where(AgentProfile.user_id == user_id)
        ).scalar_one_or_none()
        return self._profile_to_dto(db, p) if p else None

    def get_profile_by_agent_number(self, db: Session, agent_number: str) -> dict[str, Any] | None:
        p = db.execute(
            select(AgentProfile).where(AgentProfile.agent_number == agent_number)
        ).scalar_one_or_none()
        return self._profile_to_dto(db, p) if p else None

    def create_profile(
        self,
        db: Session,
        *,
        user_id: UUID,
        **fields,
    ) -> AgentProfile:
        """Create an agent_profile row. Auto-generates agent_number from the
        user's role. Raises ValueError if the user doesn't exist or if a
        profile already exists for that user.
        """
        user = db.get(User, user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        existing = db.execute(
            select(AgentProfile).where(AgentProfile.user_id == user_id)
        ).scalar_one_or_none()
        if existing:
            raise ValueError(f"agent_profile already exists for user {user_id}")

        role_name = None
        if user.role_id:
            role = db.get(Role, user.role_id)
            role_name = role.name if role else None

        agent_number = self._generate_agent_number(db, role_name)

        profile = AgentProfile(
            user_id=user_id,
            agent_number=agent_number,
            **{k: v for k, v in fields.items() if v is not None},
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    def delete_profile(self, db: Session, profile_id: UUID) -> bool:
        """Hard-delete an agent_profile row. The underlying User record and
        any commission_ledger rows referencing the user are preserved — only
        the agent_profile satellite is removed."""
        p = db.get(AgentProfile, profile_id)
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True

    def update_profile(
        self,
        db: Session,
        profile_id: UUID,
        **fields,
    ) -> AgentProfile | None:
        """Partial update — only non-None fields are written. agent_number
        and user_id are NEVER updated (immutable after creation).
        """
        IMMUTABLE = {"id", "user_id", "agent_number", "created_at", "created_by_id"}
        p = db.get(AgentProfile, profile_id)
        if not p:
            return None
        for key, value in fields.items():
            if key in IMMUTABLE:
                continue
            if value is None:
                continue
            if hasattr(p, key):
                setattr(p, key, value)
        db.commit()
        db.refresh(p)
        return p

    # ─── Satellites (read-only for now) ───────────────────────────────────

    def list_licenses(self, db: Session, user_id: UUID) -> list[AgentLicense]:
        return db.execute(
            select(AgentLicense)
            .where(AgentLicense.user_id == user_id)
            .order_by(AgentLicense.state, AgentLicense.license_type)
        ).scalars().all()

    def create_license(self, db: Session, *, user_id: UUID, **fields) -> AgentLicense:
        # Defensive: raise a readable error on the composite-unique clash rather
        # than let IntegrityError bubble.
        dup = db.execute(
            select(AgentLicense).where(
                AgentLicense.user_id == user_id,
                AgentLicense.state == fields.get("state"),
                AgentLicense.license_type == fields.get("license_type"),
                AgentLicense.license_number == fields.get("license_number"),
            )
        ).scalar_one_or_none()
        if dup:
            raise ValueError(
                f"License already exists for user {user_id}: "
                f"{fields.get('state')} {fields.get('license_type')} {fields.get('license_number')}"
            )
        lic = AgentLicense(user_id=user_id, **{k: v for k, v in fields.items() if v is not None})
        db.add(lic)
        db.commit()
        db.refresh(lic)
        return lic

    def update_license(self, db: Session, license_id: UUID, **fields) -> AgentLicense | None:
        IMMUTABLE = {"id", "user_id", "created_at", "created_by_id"}
        lic = db.get(AgentLicense, license_id)
        if not lic:
            return None
        for key, value in fields.items():
            if key in IMMUTABLE:
                continue
            if value is None:
                continue
            if hasattr(lic, key):
                setattr(lic, key, value)
        db.commit()
        db.refresh(lic)
        return lic

    def delete_license(self, db: Session, license_id: UUID) -> bool:
        lic = db.get(AgentLicense, license_id)
        if not lic:
            return False
        db.delete(lic)
        db.commit()
        return True

    def get_banking(self, db: Session, user_id: UUID) -> AgentBanking | None:
        return db.execute(
            select(AgentBanking).where(AgentBanking.user_id == user_id)
        ).scalar_one_or_none()

    def list_documents(self, db: Session, user_id: UUID) -> list[dict[str, Any]]:
        """List an agent's uploaded documents (user_personal_file entries).

        UserPersonalFile is joined-inheritance on File, so a single instance
        exposes both the personal-file-specific columns (state,
        expiration_date) and the file-table columns (name, type, size).
        """
        rows = db.execute(
            select(UserPersonalFile).where(UserPersonalFile.owner_id == user_id)
        ).scalars().all()
        return [
            {
                "id": upf.id,
                "state": upf.state,
                "expiration_date": upf.expiration_date,
                "name": getattr(upf, "name", None),
                "type": getattr(upf, "type", None),
                "size": getattr(upf, "size", None),
            }
            for upf in rows
        ]

    # ─── Internals ────────────────────────────────────────────────────────

    def _profile_to_dto(self, db: Session, p: AgentProfile) -> dict[str, Any]:
        """Render an AgentProfile with denormalized user + role fields for the API."""
        user = db.get(User, p.user_id)
        role_name = ""
        if user and user.role_id:
            role = db.get(Role, user.role_id)
            role_name = role.name if role else ""
        user_name = ""
        user_email = ""
        is_active = False
        if user:
            user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
            user_email = user.email
            is_active = bool(user.is_active)

        return {
            "id": p.id,
            "user_id": p.user_id,
            "agent_number": p.agent_number,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": role_name,
            "is_active": is_active,
            "ssn_or_itin_last4": p.ssn_or_itin_last4,
            "tax_classification": p.tax_classification,
            "w9_signed_at": p.w9_signed_at,
            "w9_file_id": p.w9_file_id,
            "employment_start_date": p.employment_start_date,
            "employment_end_date": p.employment_end_date,
            "termination_reason": p.termination_reason,
            "background_check_status": p.background_check_status,
            "background_check_completed_at": p.background_check_completed_at,
            "drug_test_passed_at": p.drug_test_passed_at,
            "non_compete_signed_at": p.non_compete_signed_at,
            "non_compete_file_id": p.non_compete_file_id,
            "emergency_contact_name": p.emergency_contact_name,
            "emergency_contact_phone": p.emergency_contact_phone,
            "beneficiary_name": p.beneficiary_name,
            "beneficiary_relationship": p.beneficiary_relationship,
            "commission_tier_override": p.commission_tier_override,
            "adjuster_comp_type": p.adjuster_comp_type,
            "adjuster_comp_percent": p.adjuster_comp_percent,
            "adjuster_annual_salary": p.adjuster_annual_salary,
            "adjuster_hourly_rate": p.adjuster_hourly_rate,
            "adjuster_comp_effective_date": p.adjuster_comp_effective_date,
            "notes": p.notes,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }


agent_service = AgentService()
