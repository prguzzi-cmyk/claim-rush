"""add_dispatch_status_to_fire_incident

Adds dispatch_status (active/cleared/archived) and cleared_at columns to
the fire_incident table.  Incidents are now permanently retained — only
their status changes.

Revision ID: d1s2p3a4t5c6
Revises: x1y2z3a4b5c6
Create Date: 2026-03-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1s2p3a4t5c6'
down_revision = 'x1y2z3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add dispatch_status column with default 'active'
    op.add_column(
        'fire_incident',
        sa.Column(
            'dispatch_status',
            sa.String(20),
            server_default='active',
            nullable=False,
        ),
    )
    op.create_index(
        'ix_fire_incident_dispatch_status',
        'fire_incident',
        ['dispatch_status'],
    )

    # Add cleared_at timestamp
    op.add_column(
        'fire_incident',
        sa.Column('cleared_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Backfill: existing is_active=False rows → dispatch_status='cleared'
    op.execute(
        "UPDATE fire_incident SET dispatch_status = 'cleared' WHERE is_active = false"
    )


def downgrade() -> None:
    op.drop_index('ix_fire_incident_dispatch_status', table_name='fire_incident')
    op.drop_column('fire_incident', 'dispatch_status')
    op.drop_column('fire_incident', 'cleared_at')
