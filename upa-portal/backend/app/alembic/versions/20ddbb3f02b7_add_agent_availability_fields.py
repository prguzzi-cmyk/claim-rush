"""add_agent_availability_fields

Revision ID: 20ddbb3f02b7
Revises: x1y2z3a4b5c6
Create Date: 2026-03-15 20:09:17.754235

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20ddbb3f02b7'
down_revision = 'x1y2z3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('is_accepting_leads', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('user', sa.Column('daily_lead_limit', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'daily_lead_limit')
    op.drop_column('user', 'is_accepting_leads')
