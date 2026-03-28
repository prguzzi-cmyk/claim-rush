"""create_rotation_lead_engine

Revision ID: r0t1l2e3a4d5
Revises: w1x2y3z4a5b6
Create Date: 2026-03-14 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "r0t1l2e3a4d5"
down_revision = "w1x2y3z4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── rotation_lead ────────────────────────────────────────────────────
    op.create_table(
        "rotation_lead",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_source", sa.String(100), nullable=False),
        sa.Column("property_address", sa.String(255), nullable=False),
        sa.Column("property_city", sa.String(100), nullable=False),
        sa.Column("property_state", sa.String(2), nullable=False),
        sa.Column("property_zip", sa.String(10), nullable=False),
        sa.Column("owner_name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("incident_type", sa.String(50), nullable=False),
        sa.Column("lead_status", sa.String(30), nullable=False, server_default="new_lead"),
        sa.Column(
            "assigned_agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_rotation_lead_assigned_agent_id"),
            nullable=True,
            index=True,
        ),
        sa.Column("assignment_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_contact_attempt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contact_attempt_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("outcome", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("reassignment_count", sa.Integer, nullable=False, server_default="0"),
        # Mixins
        sa.Column("can_be_removed", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_removed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_rotation_lead_created_by_id"),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_rotation_lead_updated_by_id"),
            nullable=True,
        ),
    )
    op.create_index("ix_rotation_lead_lead_status", "rotation_lead", ["lead_status"])

    # ── rotation_lead_activity ───────────────────────────────────────────
    op.create_table(
        "rotation_lead_activity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rotation_lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("rotation_lead.id", name="fk_rotation_lead_activity_lead_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("activity_type", sa.String(30), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("old_value", sa.String(255), nullable=True),
        sa.Column("new_value", sa.String(255), nullable=True),
        sa.Column(
            "performed_by_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_rotation_lead_activity_performed_by_id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── rotation_config ──────────────────────────────────────────────────
    op.create_table(
        "rotation_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "territory_id",
            UUID(as_uuid=True),
            sa.ForeignKey("territory.id", name="fk_rotation_config_territory_id"),
            nullable=True,
            unique=True,
        ),
        sa.Column("contact_timeout_hours", sa.Integer, nullable=False, server_default="24"),
        sa.Column("max_contact_attempts", sa.Integer, nullable=False, server_default="5"),
        sa.Column("auto_reassign_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("rotation_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "last_assigned_agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_rotation_config_last_assigned_agent_id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("rotation_config")
    op.drop_table("rotation_lead_activity")
    op.drop_index("ix_rotation_lead_lead_status", table_name="rotation_lead")
    op.drop_table("rotation_lead")
