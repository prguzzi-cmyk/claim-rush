"""add lead_contact_tracker and escalation_attempt tables

Revision ID: g1h2i3j4k5l6
Revises: f0a1b2c3d4e5
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "g1h2i3j4k5l6"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- lead_contact_tracker --
    op.create_table(
        "lead_contact_tracker",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", sa.UUID(as_uuid=True), sa.ForeignKey("lead.id", name="fk_lct_lead_id", ondelete="CASCADE"), nullable=False),
        sa.Column("territory_id", sa.UUID(as_uuid=True), sa.ForeignKey("territory.id", name="fk_lct_territory_id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_type", sa.String(30), nullable=False),
        # AI Call fields
        sa.Column("ai_call_status", sa.String(30), server_default="pending", nullable=False),
        sa.Column("ai_call_sid", sa.String(100), nullable=True),
        sa.Column("ai_call_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_call_ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_call_result", sa.String(30), nullable=True),
        sa.Column("ai_call_transcript_url", sa.String(500), nullable=True),
        # Escalation state
        sa.Column("current_escalation_level", sa.Integer, server_default="1", nullable=False),
        sa.Column("current_agent_id", sa.UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_lct_current_agent_id", ondelete="SET NULL"), nullable=True),
        sa.Column("escalation_started_at", sa.DateTime(timezone=True), nullable=True),
        # Contact status
        sa.Column("contact_status", sa.String(30), server_default="new", nullable=False),
        # Resolution
        sa.Column("is_resolved", sa.Boolean, server_default="false", nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_type", sa.String(30), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lct_lead_id", "lead_contact_tracker", ["lead_id"], unique=True)
    op.create_index("ix_lct_territory_id", "lead_contact_tracker", ["territory_id"])
    op.create_index("ix_lct_contact_status", "lead_contact_tracker", ["contact_status"])
    op.create_index("ix_lct_resolved", "lead_contact_tracker", ["is_resolved"])
    op.create_index("ix_lct_escalation_level", "lead_contact_tracker", ["current_escalation_level", "is_resolved"])

    # -- escalation_attempt --
    op.create_table(
        "escalation_attempt",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("tracker_id", sa.UUID(as_uuid=True), sa.ForeignKey("lead_contact_tracker.id", name="fk_esc_attempt_tracker_id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", sa.UUID(as_uuid=True), sa.ForeignKey("lead.id", name="fk_esc_attempt_lead_id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_esc_attempt_agent_id", ondelete="CASCADE"), nullable=False),
        sa.Column("escalation_level", sa.Integer, nullable=False),
        sa.Column("escalation_label", sa.String(30), nullable=False),
        # Transfer attempt
        sa.Column("transfer_status", sa.String(30), server_default="pending", nullable=False),
        sa.Column("transfer_call_sid", sa.String(100), nullable=True),
        sa.Column("transfer_attempted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_ended_at", sa.DateTime(timezone=True), nullable=True),
        # Notification channels
        sa.Column("sms_sent", sa.Boolean, server_default="false", nullable=False),
        sa.Column("email_sent", sa.Boolean, server_default="false", nullable=False),
        sa.Column("in_app_sent", sa.Boolean, server_default="false", nullable=False),
        sa.Column("timeout_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_esc_attempt_tracker_id", "escalation_attempt", ["tracker_id"])
    op.create_index("ix_esc_attempt_lead_id", "escalation_attempt", ["lead_id"])
    op.create_index("ix_esc_attempt_agent_id", "escalation_attempt", ["agent_id"])
    op.create_index("ix_esc_attempt_tracker_level", "escalation_attempt", ["tracker_id", "escalation_level"])


def downgrade() -> None:
    op.drop_table("escalation_attempt")
    op.drop_table("lead_contact_tracker")
