"""Create lead_outcome table

Revision ID: d7e8f9a0b1c2
Revises: ce4f8a2b3d5e
Create Date: 2026-03-07 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d7e8f9a0b1c2"
down_revision = "ce4f8a2b3d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_outcome",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("outcome_status", sa.String(50), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("automation_triggered", sa.String(100), nullable=True),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lead.id", name="fk_lead_outcome_lead_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recorded_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user.id", name="fk_lead_outcome_recorded_by_id"),
            nullable=False,
        ),
        # SoftDeleteMixin
        sa.Column("can_be_removed", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_removed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        # TimestampMixin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # AuditMixin
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id"), nullable=True),
    )

    op.create_index("ix_lead_outcome_lead_id", "lead_outcome", ["lead_id"])
    op.create_index("ix_lead_outcome_recorded_by_id", "lead_outcome", ["recorded_by_id"])
    op.create_index("ix_lead_outcome_outcome_status", "lead_outcome", ["outcome_status"])


def downgrade() -> None:
    op.drop_index("ix_lead_outcome_outcome_status", table_name="lead_outcome")
    op.drop_index("ix_lead_outcome_recorded_by_id", table_name="lead_outcome")
    op.drop_index("ix_lead_outcome_lead_id", table_name="lead_outcome")
    op.drop_table("lead_outcome")
