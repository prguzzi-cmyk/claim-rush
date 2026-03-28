"""create lead_skip_trace table

Revision ID: s1k2i3p4s5h6
Revises:
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "s1k2i3p4s5h6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table creation handled by b484ce17db0d migration
    pass


def downgrade() -> None:
    pass
