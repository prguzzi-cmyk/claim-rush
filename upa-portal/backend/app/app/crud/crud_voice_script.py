#!/usr/bin/env python

"""CRUD operations for VoiceScript."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.voice_script import VoiceScript
from app.schemas.voice_script import (
    VoiceScriptCreate,
    VoiceScriptUpdate,
)


class CRUDVoiceScript(CRUDBase[VoiceScript, VoiceScriptCreate, VoiceScriptUpdate]):

    @staticmethod
    def get_by_category(
        db_session: Session,
        *,
        category: str,
    ) -> list[VoiceScript]:
        """Get all voice scripts for a given category."""
        with db_session as session:
            stmt = (
                select(VoiceScript)
                .where(
                    VoiceScript.category == category,
                    VoiceScript.is_removed.is_(False),
                )
                .order_by(VoiceScript.created_at.desc())
            )
            return list(session.scalars(stmt).all())

    @staticmethod
    def get_active_scripts(
        db_session: Session,
    ) -> list[VoiceScript]:
        """Get all active (non-removed) voice scripts."""
        with db_session as session:
            stmt = (
                select(VoiceScript)
                .where(
                    VoiceScript.is_active.is_(True),
                    VoiceScript.is_removed.is_(False),
                )
                .order_by(VoiceScript.created_at.desc())
            )
            return list(session.scalars(stmt).all())


voice_script = CRUDVoiceScript(VoiceScript)
