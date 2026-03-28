"""add lead rescue system: lead_rescue_log table + score_tier/is_rescued on lead

Revision ID: c5d6e7f8a9b0
Revises: 1a2a7e5548be
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c5d6e7f8a9b0"
down_revision = "1a2a7e5548be"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- 1. Add score_tier and is_rescued columns to lead table --
    op.add_column("lead", sa.Column("score_tier", sa.String(20), nullable=True))
    op.add_column(
        "lead",
        sa.Column("is_rescued", sa.Boolean, server_default="false", nullable=True),
    )

    # -- 2. Create lead_rescue_log table --
    op.create_table(
        "lead_rescue_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("lead.id", name="fk_rescue_lead_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tracker_id", sa.Uuid(), sa.ForeignKey("lead_contact_tracker.id", name="fk_rescue_tracker_id", ondelete="SET NULL"), nullable=True),
        sa.Column("original_agent_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_rescue_original_agent", ondelete="SET NULL"), nullable=True),
        sa.Column("new_assigned_agent_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_rescue_new_agent", ondelete="SET NULL"), nullable=True),
        sa.Column("rescue_reason", sa.String(50), nullable=False),
        sa.Column("score_tier", sa.String(20), nullable=True),
        sa.Column("rescue_level", sa.String(20), nullable=True),
        sa.Column("escalation_level_at_rescue", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_converted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("rvp_rescue", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("cp_rescue", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Indexes
    op.create_index("ix_rescue_log_lead_id", "lead_rescue_log", ["lead_id"])
    op.create_index("ix_rescue_log_reason", "lead_rescue_log", ["rescue_reason"])
    op.create_index("ix_rescue_log_converted", "lead_rescue_log", ["is_converted"])


def downgrade() -> None:
    op.drop_index("ix_rescue_log_converted", table_name="lead_rescue_log")
    op.drop_index("ix_rescue_log_reason", table_name="lead_rescue_log")
    op.drop_index("ix_rescue_log_lead_id", table_name="lead_rescue_log")
    op.drop_table("lead_rescue_log")
    op.drop_column("lead", "is_rescued")
    op.drop_column("lead", "score_tier")
