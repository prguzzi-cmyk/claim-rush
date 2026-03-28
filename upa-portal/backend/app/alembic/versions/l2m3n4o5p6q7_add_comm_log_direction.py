"""add direction and fire_incident_id to communication_log

Revision ID: l2m3n4o5p6q7
Revises: k1l3m5n7o9p1
Create Date: 2026-03-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "l2m3n4o5p6q7"
down_revision = "k1l3m5n7o9p1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "communication_log",
        sa.Column("direction", sa.String(10), server_default="outbound", nullable=False),
    )
    op.add_column(
        "communication_log",
        sa.Column(
            "fire_incident_id",
            sa.Uuid(),
            sa.ForeignKey("fire_incident.id", name="fk_comm_log_fire_incident_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_comm_log_recipient_phone", "communication_log", ["recipient_phone"])


def downgrade() -> None:
    op.drop_index("ix_comm_log_recipient_phone", table_name="communication_log")
    op.drop_column("communication_log", "fire_incident_id")
    op.drop_column("communication_log", "direction")
