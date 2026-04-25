"""Create client_portal_lead and client_portal_follow_up tables.

Adds two missing tables for the public intake flow used by upaclaim.org and
related front doors. Both tables are referenced by app/models/client_portal_lead.py
and app/services/client_portal_lead_service.py, but no prior migration
created them — this fills that gap.

Includes the new intake-friendly columns on client_portal_lead:
  - source_site  (originating domain, e.g. upaclaim.org)
  - message      (free-form intake note from the homeowner)

The `name` column remains NOT NULL on the table; the Pydantic schema
combines first_name + last_name into name before persisting, so the DB
constraint stays strict regardless of which payload shape callers send.

Revision ID: cp1l_intake01
Revises: r0le_d3m001
Create Date: 2026-04-25 15:55:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "cp1l_intake01"
down_revision = "r0le_d3m001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── client_portal_lead ─────────────────────────────────────────────
    op.create_table(
        "client_portal_lead",
        # Base
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        # SoftDeleteMixin
        sa.Column("can_be_removed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.false()),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # Contact information
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        # Claim context
        sa.Column("incident_type", sa.String(length=50), nullable=True),
        sa.Column("claim_number", sa.String(length=50), nullable=True),
        sa.Column("photo_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("has_3d_scan", sa.Boolean(), nullable=False, server_default=sa.false()),
        # Status tracking
        sa.Column("status", sa.String(length=30), nullable=False, server_default="new"),
        sa.Column(
            "qualification_status",
            sa.String(length=30),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="client_portal"),
        # New intake-friendly columns
        sa.Column("source_site", sa.String(length=200), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        # Engagement tracking
        sa.Column("last_contact_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("follow_up_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Appointment
        sa.Column("appointment_date", sa.String(length=50), nullable=True),
        sa.Column("appointment_time", sa.String(length=20), nullable=True),
        sa.Column("appointment_timezone", sa.String(length=50), nullable=True),
        sa.Column("calendar_event_id", sa.String(length=200), nullable=True),
        # Qualification details
        sa.Column("qualification_notes", sa.Text(), nullable=True),
        sa.Column("estimated_severity", sa.String(length=30), nullable=True),
        # Linked entities (FKs match the constraint names declared in the model)
        sa.Column("lead_id", UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_agent_id", UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["lead.id"], name="fk_cpl_lead_id", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["assigned_agent_id"],
            ["user.id"],
            name="fk_cpl_assigned_agent",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_client_portal_lead_status", "client_portal_lead", ["status"]
    )
    op.create_index(
        "ix_client_portal_lead_source", "client_portal_lead", ["source"]
    )
    op.create_index(
        "ix_client_portal_lead_email", "client_portal_lead", ["email"]
    )
    op.create_index(
        "ix_client_portal_lead_phone", "client_portal_lead", ["phone"]
    )
    op.create_index(
        "ix_client_portal_lead_created_at", "client_portal_lead", ["created_at"]
    )

    # ── client_portal_follow_up ────────────────────────────────────────
    op.create_table(
        "client_portal_follow_up",
        # Base
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        # TimestampMixin
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # Foreign key to lead
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        # Follow-up details
        sa.Column("follow_up_type", sa.String(length=30), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("message_key", sa.String(length=100), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=True),
        # Scheduling
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        # Status
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["client_portal_lead.id"],
            name="fk_cpfu_lead_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_client_portal_follow_up_lead_id", "client_portal_follow_up", ["lead_id"]
    )
    op.create_index(
        "ix_client_portal_follow_up_status", "client_portal_follow_up", ["status"]
    )
    op.create_index(
        "ix_client_portal_follow_up_scheduled_at",
        "client_portal_follow_up",
        ["scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_client_portal_follow_up_scheduled_at", table_name="client_portal_follow_up")
    op.drop_index("ix_client_portal_follow_up_status", table_name="client_portal_follow_up")
    op.drop_index("ix_client_portal_follow_up_lead_id", table_name="client_portal_follow_up")
    op.drop_table("client_portal_follow_up")

    op.drop_index("ix_client_portal_lead_created_at", table_name="client_portal_lead")
    op.drop_index("ix_client_portal_lead_phone", table_name="client_portal_lead")
    op.drop_index("ix_client_portal_lead_email", table_name="client_portal_lead")
    op.drop_index("ix_client_portal_lead_source", table_name="client_portal_lead")
    op.drop_index("ix_client_portal_lead_status", table_name="client_portal_lead")
    op.drop_table("client_portal_lead")
