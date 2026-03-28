"""create inspection scheduling tables

Revision ID: a218b6a21674
Revises: f5cf57d8b3a9
Create Date: 2026-03-15 21:48:10.649591

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a218b6a21674"
down_revision = "f5cf57d8b3a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "adjuster_availability",
        sa.Column("adjuster_id", sa.UUID(), nullable=False),
        sa.Column("available_days", sa.String(length=20), nullable=False),
        sa.Column("start_hour", sa.Integer(), nullable=False),
        sa.Column("end_hour", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["adjuster_id"], ["user.id"], name="fk_adjuster_availability_adjuster_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("adjuster_id"),
        mysql_engine="InnoDB",
    )
    op.create_table(
        "adjuster_blocked_slot",
        sa.Column("availability_id", sa.UUID(), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=False),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["availability_id"], ["adjuster_availability.id"], name="fk_adjuster_blocked_slot_availability_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
    )
    op.create_table(
        "inspection_schedule",
        sa.Column("lead_id", sa.UUID(), nullable=True),
        sa.Column("homeowner_name", sa.String(length=200), nullable=False),
        sa.Column("homeowner_phone", sa.String(length=20), nullable=True),
        sa.Column("homeowner_email", sa.String(length=255), nullable=True),
        sa.Column("property_address", sa.String(length=500), nullable=False),
        sa.Column("adjuster_id", sa.UUID(), nullable=True),
        sa.Column("inspection_date", sa.String(length=10), nullable=False),
        sa.Column("inspection_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reminders_sent", sa.Integer(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=True),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["adjuster_id"], ["user.id"], name="fk_inspection_schedule_adjuster_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"], name="fk_inspection_schedule_created_by_id", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["lead.id"], name="fk_inspection_schedule_lead_id", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
    )


def downgrade() -> None:
    op.drop_table("inspection_schedule")
    op.drop_table("adjuster_blocked_slot")
    op.drop_table("adjuster_availability")
