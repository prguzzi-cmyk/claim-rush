"""enhance_claim_task_workflow

Revision ID: w1x2y3z4a5b6
Revises: 7abec4122e17
Create Date: 2026-03-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'w1x2y3z4a5b6'
down_revision = '7abec4122e17'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add related_claim_phase column to claim_task table
    op.add_column(
        'claim_task',
        sa.Column('related_claim_phase', sa.String(50), nullable=True),
    )

    # Widen activity_type column from VARCHAR(20) to VARCHAR(30)
    op.alter_column(
        'user_activity',
        'activity_type',
        type_=sa.String(30),
        existing_type=sa.String(20),
    )

    # Migrate existing claim task statuses: to-do → pending
    op.execute(
        """
        UPDATE user_task
        SET status = 'pending'
        WHERE status = 'to-do'
          AND type = 'claim_task'
        """
    )

    # Migrate existing claim task statuses: done → completed
    op.execute(
        """
        UPDATE user_task
        SET status = 'completed'
        WHERE status = 'done'
          AND type = 'claim_task'
        """
    )


def downgrade() -> None:
    # Reverse status migration: pending → to-do
    op.execute(
        """
        UPDATE user_task
        SET status = 'to-do'
        WHERE status = 'pending'
          AND type = 'claim_task'
        """
    )

    # Reverse status migration: completed → done
    op.execute(
        """
        UPDATE user_task
        SET status = 'done'
        WHERE status = 'completed'
          AND type = 'claim_task'
        """
    )

    # Revert activity_type column width
    op.alter_column(
        'user_activity',
        'activity_type',
        type_=sa.String(20),
        existing_type=sa.String(30),
    )

    # Drop related_claim_phase column
    op.drop_column('claim_task', 'related_claim_phase')
