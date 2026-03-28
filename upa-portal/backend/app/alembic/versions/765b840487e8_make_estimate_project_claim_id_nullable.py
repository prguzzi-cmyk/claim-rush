"""make estimate_project claim_id nullable

Revision ID: 765b840487e8
Revises: f6a7b8c9d0e1
Create Date: 2026-03-03 18:52:12.326781

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '765b840487e8'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('estimate_project', 'claim_id',
               existing_type=sa.UUID(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('estimate_project', 'claim_id',
               existing_type=sa.UUID(),
               nullable=False)
