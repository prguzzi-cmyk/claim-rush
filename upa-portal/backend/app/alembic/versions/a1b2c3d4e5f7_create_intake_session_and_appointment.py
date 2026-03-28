"""create intake_session and intake_appointment tables

Revision ID: a1b2c3d4e5f7
Revises:
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = None  # Update this to point to the latest migration head
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intake_session",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("homeowner_name", sa.String(200), nullable=True),
        sa.Column("property_address", sa.String(500), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("incident_type", sa.String(100), nullable=True),
        sa.Column("date_of_loss", sa.DateTime(timezone=True), nullable=True),
        sa.Column("insurance_company", sa.String(200), nullable=True),
        sa.Column("policy_number", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("conversation_log", sa.Text(), nullable=True),
        sa.Column("current_step", sa.String(50), nullable=False, server_default="greeting"),
        sa.Column("is_qualified", sa.Boolean(), nullable=True),
        sa.Column("qualification_reason", sa.String(500), nullable=True),
        sa.Column("qualification_score", sa.Float(), nullable=True),
        sa.Column("lead_id", sa.UUID(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lead_id"], ["lead.id"], name="fk_intake_session_lead_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user.id"], name="fk_intake_session_user_id", ondelete="SET NULL"),
    )

    op.create_table(
        "intake_appointment",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("appointment_type", sa.String(30), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("homeowner_name", sa.String(200), nullable=True),
        sa.Column("homeowner_email", sa.String(200), nullable=True),
        sa.Column("homeowner_phone", sa.String(30), nullable=True),
        sa.Column("property_address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="scheduled"),
        sa.Column("session_id", sa.UUID(), nullable=True),
        sa.Column("assigned_to", sa.UUID(), nullable=True),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["intake_session.id"], name="fk_intake_appt_session_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_to"], ["user.id"], name="fk_intake_appt_assigned_to", ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("intake_appointment")
    op.drop_table("intake_session")
