"""merge heads

Revision ID: 1a2a7e5548be
Revises: b2c3d4e5f6a8, d3a7f1c8e592
Create Date: 2026-03-21 10:41:31.033791

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1a2a7e5548be'
down_revision = ('b2c3d4e5f6a8', 'd3a7f1c8e592')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
