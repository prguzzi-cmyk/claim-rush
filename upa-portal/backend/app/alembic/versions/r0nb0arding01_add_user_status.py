"""user.status field for the regularization onboarding flow

Adds a 3-state status column to user that gates portal access during
the existing-member regularization flow:

    pending_charter   — invited, hasn't signed the charter agreement
                        yet. NO portal access.
    pending_w9        — charter signed, portal access ON, W-9 reminder
                        banner shows.
    active            — W-9 received, banner gone, full access.

Existing rows are backfilled to 'active' so no current user loses
access. CHECK constraint enforces the enum at the DB layer.

Revision ID: r0nb0arding01
Revises: c0mm155ag09
Create Date: 2026-04-22 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'r0nb0arding01'
down_revision = 'c0mm155ag09'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column('status', sa.String(30), nullable=True),
    )
    op.execute("""
        UPDATE "user" SET status = 'active' WHERE status IS NULL;
    """)
    op.alter_column('user', 'status', nullable=False)
    op.create_check_constraint(
        'ck_user_status',
        'user',
        "status IN ('pending_charter', 'pending_w9', 'active')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_user_status', 'user', type_='check')
    op.drop_column('user', 'status')
