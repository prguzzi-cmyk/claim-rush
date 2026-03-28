"""add_action_type_to_skiptrace_transaction

Revision ID: 35fed1910100
Revises: l2m3n4o5p6q7
Create Date: 2026-03-11 15:26:27.035468

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '35fed1910100'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'skiptrace_transaction',
        sa.Column('action_type', sa.String(length=30), nullable=False, server_default='skip_trace'),
    )


def downgrade() -> None:
    op.drop_column('skiptrace_transaction', 'action_type')
