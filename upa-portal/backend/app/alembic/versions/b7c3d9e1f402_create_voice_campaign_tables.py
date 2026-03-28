"""create voice campaign tables

Revision ID: b7c3d9e1f402
Revises: a218b6a21674
Create Date: 2026-03-16

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "b7c3d9e1f402"
down_revision = "a218b6a21674"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # voice_campaign
    op.create_table(
        "voice_campaign",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("script_template", sa.Text(), nullable=True),
        sa.Column("lead_source_filter", sa.String(30), nullable=True),
        sa.Column("territory_state_filter", sa.String(2), nullable=True),
        sa.Column("incident_type_filter", sa.String(50), nullable=True),
        sa.Column("call_window_start", sa.String(5), server_default="09:00", nullable=False),
        sa.Column("call_window_end", sa.String(5), server_default="17:00", nullable=False),
        sa.Column("call_window_timezone", sa.String(50), server_default="America/New_York", nullable=False),
        sa.Column("max_retries", sa.Integer(), server_default="3", nullable=False),
        sa.Column("retry_delay_minutes", sa.Integer(), server_default="120", nullable=False),
        sa.Column("max_calls_per_day", sa.Integer(), server_default="100", nullable=False),
        sa.Column("total_leads_targeted", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_calls_placed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_calls_answered", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_appointments_booked", sa.Integer(), server_default="0", nullable=False),
        sa.Column("launched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_voice_campaign_created_by_id", ondelete="SET NULL"), nullable=True),
        # SoftDeleteMixin
        sa.Column("can_be_removed", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_removed", sa.Boolean(), server_default="false", nullable=False),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # voice_call_log
    op.create_table(
        "voice_call_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("voice_campaign.id", name="fk_voice_call_log_campaign_id", ondelete="SET NULL"), nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("lead.id", name="fk_voice_call_log_lead_id", ondelete="SET NULL"), nullable=True),
        sa.Column("lead_name", sa.String(200), nullable=True),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("call_sid", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), server_default="pending", nullable=False),
        sa.Column("outcome", sa.String(50), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), server_default="0", nullable=False),
        sa.Column("transcript_text", sa.Text(), nullable=True),
        sa.Column("transcript_url", sa.String(500), nullable=True),
        sa.Column("transcript_summary", sa.String(500), nullable=True),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("cost_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_voice_call_log_agent_id", ondelete="SET NULL"), nullable=True),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_voice_call_log_campaign_id", "voice_call_log", ["campaign_id"])
    op.create_index("ix_voice_call_log_lead_id", "voice_call_log", ["lead_id"])
    op.create_index("ix_voice_call_log_status", "voice_call_log", ["status"])
    op.create_index("ix_voice_call_log_outcome", "voice_call_log", ["outcome"])

    # voice_usage_record
    op.create_table(
        "voice_usage_record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("user.id", name="fk_voice_usage_record_account_id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("minutes_used", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("plan_limit_minutes", sa.Float(), server_default="500.0", nullable=False),
        sa.Column("overage_minutes", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("cost_cents", sa.Integer(), server_default="0", nullable=False),
        sa.Column("call_count", sa.Integer(), server_default="0", nullable=False),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_voice_usage_record_account_id", "voice_usage_record", ["account_id"])


def downgrade() -> None:
    op.drop_table("voice_usage_record")
    op.drop_table("voice_call_log")
    op.drop_table("voice_campaign")
