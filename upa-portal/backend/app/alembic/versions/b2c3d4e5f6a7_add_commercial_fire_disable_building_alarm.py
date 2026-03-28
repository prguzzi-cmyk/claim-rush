"""Add Commercial Fire call type and disable Building Alarm

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-27 18:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Disable Building Alarm
    op.execute(
        "UPDATE call_type_config SET is_enabled = false WHERE code = 'BA'"
    )

    # Add Commercial Fire if it doesn't already exist
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id FROM call_type_config WHERE code = 'CF'")
    )
    if result.fetchone() is None:
        op.execute(
            sa.text(
                "INSERT INTO call_type_config (id, code, description, is_enabled, sort_order, created_at) "
                "VALUES (:id, 'CF', 'Commercial Fire', true, 1, now())"
            ).bindparams(id=str(uuid.uuid4()))
        )
    else:
        op.execute(
            "UPDATE call_type_config SET is_enabled = true WHERE code = 'CF'"
        )


def downgrade() -> None:
    # Re-enable Building Alarm
    op.execute(
        "UPDATE call_type_config SET is_enabled = true WHERE code = 'BA'"
    )
    # Disable Commercial Fire (don't delete in case it has references)
    op.execute(
        "UPDATE call_type_config SET is_enabled = false WHERE code = 'CF'"
    )
