"""add lead type flags to territory

Revision ID: 4c52f44a8aba
Revises: 1c24cd87829a
Create Date: 2026-03-07 10:52:33.221779

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4c52f44a8aba'
down_revision = '1c24cd87829a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('territory', sa.Column('lead_fire_enabled', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('territory', sa.Column('lead_hail_enabled', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('territory', sa.Column('lead_storm_enabled', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('territory', sa.Column('lead_lightning_enabled', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('territory', sa.Column('lead_flood_enabled', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('territory', sa.Column('lead_theft_vandalism_enabled', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    op.drop_column('territory', 'lead_theft_vandalism_enabled')
    op.drop_column('territory', 'lead_flood_enabled')
    op.drop_column('territory', 'lead_lightning_enabled')
    op.drop_column('territory', 'lead_storm_enabled')
    op.drop_column('territory', 'lead_hail_enabled')
    op.drop_column('territory', 'lead_fire_enabled')
