#!/usr/bin/env python

"""CRUD operations for outreach templates"""

import re
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.outreach_template import OutreachTemplate
from app.schemas.outreach_template import OutreachTemplateCreate, OutreachTemplateUpdate


class CRUDOutreachTemplate(CRUDBase[OutreachTemplate, OutreachTemplateCreate, OutreachTemplateUpdate]):

    def get_by_channel(
        self, db_session: Session, *, channel: str
    ) -> Sequence[OutreachTemplate]:
        with db_session as session:
            stmt = (
                select(OutreachTemplate)
                .where(OutreachTemplate.channel == channel)
                .order_by(OutreachTemplate.created_at.desc())
            )
            return session.scalars(stmt).all()

    @staticmethod
    def render_template(body: str, variables: dict[str, str]) -> str:
        """Replace {{var}} placeholders with variable values."""
        def replacer(match):
            key = match.group(1).strip()
            return variables.get(key, match.group(0))

        return re.sub(r"\{\{(\w+)\}\}", replacer, body)


outreach_template = CRUDOutreachTemplate(OutreachTemplate)
