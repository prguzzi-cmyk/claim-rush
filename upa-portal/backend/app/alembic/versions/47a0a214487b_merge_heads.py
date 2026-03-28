"""merge_heads

Revision ID: 47a0a214487b
Revises: 8ecbe7dc5d52, ab42cdc0288a
Create Date: 2026-02-26 11:46:54.538981

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '47a0a214487b'
down_revision = ('8ecbe7dc5d52', 'ab42cdc0288a')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
