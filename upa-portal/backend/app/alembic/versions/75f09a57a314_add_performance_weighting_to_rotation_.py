"""add_performance_weighting_to_rotation_config

Revision ID: 75f09a57a314
Revises: 20ddbb3f02b7
Create Date: 2026-03-15 20:15:34.450808

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '75f09a57a314'
down_revision = '20ddbb3f02b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('rotation_config', sa.Column('use_performance_weighting', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('rotation_config', sa.Column('weight_closing_rate', sa.Float(), server_default='0.4', nullable=False))
    op.add_column('rotation_config', sa.Column('weight_response_speed', sa.Float(), server_default='0.3', nullable=False))
    op.add_column('rotation_config', sa.Column('weight_satisfaction', sa.Float(), server_default='0.3', nullable=False))


def downgrade() -> None:
    op.drop_column('rotation_config', 'weight_satisfaction')
    op.drop_column('rotation_config', 'weight_response_speed')
    op.drop_column('rotation_config', 'weight_closing_rate')
    op.drop_column('rotation_config', 'use_performance_weighting')
