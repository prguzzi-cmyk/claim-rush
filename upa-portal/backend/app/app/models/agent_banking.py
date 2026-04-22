#!/usr/bin/env python

"""SQLAlchemy model for the agent_banking table.

1:1 with `user`. Display-safe banking metadata for agents:
disbursement method, account-holder name, bank name, the last 4 of both
account and routing numbers, and links to ACH authorization docs.

TODO: FULL ACCOUNT + ROUTING NUMBERS ARE NOT STORED HERE.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Intentional hole: the display-safe `_last4` columns on this table are
safe to read from anywhere in the app. Full routing + account numbers
must be stored encrypted-at-rest elsewhere (KMS-backed secret store or
equivalent), accessible only to the payout-processing service with
per-request audit. That mechanism is TBD — target a later session.

Rows can exist here without full numbers; the payout pipeline will
fail-closed until encryption infra is wired. Do NOT add plaintext
account/routing columns to this table; put them in the external store.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Separated from `agent_profile` so write permissions can be locked
down independently — routine profile edits shouldn't carry payout-
banking write access.
"""

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.db.mixins import AuditMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models import File, User


class AgentBanking(TimestampMixin, AuditMixin, Base):
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("user.id", name="fk_agent_banking_user_id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    # 'ACH' | 'CHECK' | 'WIRE' | 'NONE'
    payout_method: Mapped[str | None] = mapped_column(String(20), nullable=True)

    account_holder_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Display-safe last-four values. See module docstring re: encryption.
    account_number_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    routing_number_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    ach_authorization_signed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    ach_authorization_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "file.id",
            name="fk_agent_banking_ach_auth_file_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], viewonly=True, lazy="joined"
    )
    ach_authorization_file: Mapped["File | None"] = relationship(
        foreign_keys=[ach_authorization_file_id], viewonly=True, lazy="joined"
    )
