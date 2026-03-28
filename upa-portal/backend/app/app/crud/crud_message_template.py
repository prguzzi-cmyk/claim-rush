#!/usr/bin/env python

"""CRUD operations for MessageTemplate."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.message_template import MessageTemplate
from app.schemas.message_template import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
)


class CRUDMessageTemplate(CRUDBase[MessageTemplate, MessageTemplateCreate, MessageTemplateUpdate]):

    @staticmethod
    def get_by_category(
        db_session: Session,
        *,
        category: str,
    ) -> list[MessageTemplate]:
        """Get all templates for a given category."""
        with db_session as session:
            stmt = (
                select(MessageTemplate)
                .where(
                    MessageTemplate.category == category,
                    MessageTemplate.is_removed.is_(False),
                )
                .order_by(MessageTemplate.created_at.desc())
            )
            return list(session.scalars(stmt).all())

    @staticmethod
    def get_active_templates(
        db_session: Session,
    ) -> list[MessageTemplate]:
        """Get all active (non-removed) templates."""
        with db_session as session:
            stmt = (
                select(MessageTemplate)
                .where(
                    MessageTemplate.is_active.is_(True),
                    MessageTemplate.is_removed.is_(False),
                )
                .order_by(MessageTemplate.created_at.desc())
            )
            return list(session.scalars(stmt).all())


message_template = CRUDMessageTemplate(MessageTemplate)
