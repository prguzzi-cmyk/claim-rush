"""merge heads

Revision ID: 8ecbe7dc5d52
Revises: 0eb011fb4741, c46ca6f934ab
Create Date: 2025-03-25 07:41:21.329872

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8ecbe7dc5d52"
down_revision = ("0eb011fb4741", "c46ca6f934ab")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
