"""create communication_log table

Revision ID: e9f0a1b2c3d4
Revises: d7e8f9a0b1c2
Create Date: 2026-03-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "e9f0a1b2c3d4"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "communication_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("lead.id", name="fk_comm_log_lead_id", ondelete="CASCADE"), nullable=True),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_comm_log_agent_id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel", sa.String(10), nullable=False),
        sa.Column("purpose", sa.String(50), nullable=False),
        sa.Column("template_type", sa.String(100), nullable=True),
        sa.Column("recipient_email", sa.String(255), nullable=True),
        sa.Column("recipient_phone", sa.String(20), nullable=True),
        sa.Column("provider_message_id", sa.String(255), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body_preview", sa.String(500), nullable=True),
        sa.Column("send_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.String(1000), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_queued_for_quiet_hours", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("scheduled_send_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_manual_override", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_comm_log_lead_channel", "communication_log", ["lead_id", "channel"])
    op.create_index("ix_comm_log_lead_purpose", "communication_log", ["lead_id", "purpose"])
    op.create_index("ix_comm_log_send_status", "communication_log", ["send_status"])
    op.create_index("ix_comm_log_quiet_hours", "communication_log", ["is_queued_for_quiet_hours", "scheduled_send_at"])


def downgrade() -> None:
    op.drop_index("ix_comm_log_quiet_hours", table_name="communication_log")
    op.drop_index("ix_comm_log_send_status", table_name="communication_log")
    op.drop_index("ix_comm_log_lead_purpose", table_name="communication_log")
    op.drop_index("ix_comm_log_lead_channel", table_name="communication_log")
    op.drop_table("communication_log")
