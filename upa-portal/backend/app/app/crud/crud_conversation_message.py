#!/usr/bin/env python

"""CRUD operations for conversation messages"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.conversation_message import ConversationMessage
from app.schemas.conversation_message import ConversationMessageCreate, ConversationMessageUpdate


class CRUDConversationMessage(CRUDBase[ConversationMessage, ConversationMessageCreate, ConversationMessageUpdate]):

    def get_thread(
        self, db_session: Session, *, lead_id: UUID
    ) -> Sequence[ConversationMessage]:
        with db_session as session:
            stmt = (
                select(ConversationMessage)
                .where(ConversationMessage.lead_id == lead_id)
                .order_by(ConversationMessage.created_at.asc())
            )
            return session.scalars(stmt).all()


conversation_message = CRUDConversationMessage(ConversationMessage)
