"""add intake_config table for admin control layer

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intake_config",
        sa.Column("id", sa.Uuid(), primary_key=True),
        # Identity
        sa.Column("intake_name", sa.String(150), server_default="ACI Claim Intake"),
        sa.Column("slug", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("campaign_tag", sa.String(100), nullable=True),
        # Representative
        sa.Column("rep_name", sa.String(150), nullable=True),
        sa.Column("rep_title", sa.String(100), nullable=True),
        sa.Column("rep_phone", sa.String(30), nullable=True),
        sa.Column("rep_email", sa.String(150), nullable=True),
        sa.Column("ai_secretary_enabled", sa.Boolean(), server_default="false"),
        # Hierarchy
        sa.Column("assigned_cp_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_intake_cfg_cp", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_rvp_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_intake_cfg_rvp", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_agent_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_intake_cfg_agent", ondelete="SET NULL"), nullable=True),
        sa.Column("territory_id", sa.Uuid(), sa.ForeignKey("territory.id", name="fk_intake_cfg_territory", ondelete="SET NULL"), nullable=True),
        # Routing
        sa.Column("default_assignee_id", sa.Uuid(), sa.ForeignKey("user.id", name="fk_intake_cfg_default_assignee", ondelete="SET NULL"), nullable=True),
        sa.Column("fallback_home_office", sa.Boolean(), server_default="true"),
        sa.Column("rescue_enabled", sa.Boolean(), server_default="true"),
        sa.Column("territory_enforcement", sa.Boolean(), server_default="false"),
        # Scripts
        sa.Column("voice_script_version", sa.String(50), nullable=True),
        sa.Column("sms_script_version", sa.String(50), nullable=True),
        sa.Column("intake_opening_script", sa.Text(), nullable=True),
        sa.Column("brochure_link", sa.String(500), nullable=True),
        # Links
        sa.Column("public_url", sa.String(500), nullable=True),
        sa.Column("tracked_outreach_url", sa.String(500), nullable=True),
        sa.Column("qr_link", sa.String(500), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("intake_config")
