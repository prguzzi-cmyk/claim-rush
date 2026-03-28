"""add_cp_and_adjuster_capacity_to_territory

Revision ID: 1c24cd87829a
Revises: f6a8b0c2d4e7
Create Date: 2026-03-06 16:01:43.679651

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1c24cd87829a'
down_revision = 'f6a8b0c2d4e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('territory', sa.Column('chapter_president_id', sa.UUID(), nullable=True))
    op.add_column('territory', sa.Column('max_adjusters', sa.Integer(), server_default='3', nullable=False))
    op.create_index(op.f('ix_territory_chapter_president_id'), 'territory', ['chapter_president_id'], unique=False)
    op.create_foreign_key('fk_territory_chapter_president_id', 'territory', 'user', ['chapter_president_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_territory_chapter_president_id', 'territory', type_='foreignkey')
    op.drop_index(op.f('ix_territory_chapter_president_id'), table_name='territory')
    op.drop_column('territory', 'max_adjusters')
    op.drop_column('territory', 'chapter_president_id')
