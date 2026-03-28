"""add_parser_metadata_fields

Revision ID: b5d6e7f8a9c0
Revises: 94fe22eb3b9e
Create Date: 2026-03-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b5d6e7f8a9c0'
down_revision = '94fe22eb3b9e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # carrier_estimate: add parser_type and parse_confidence
    op.add_column('carrier_estimate', sa.Column('parser_type', sa.String(length=30), nullable=True))
    op.add_column('carrier_estimate', sa.Column('parse_confidence', sa.String(length=10), nullable=True))

    # carrier_line_item: add line_item_code and confidence
    op.add_column('carrier_line_item', sa.Column('line_item_code', sa.String(length=50), nullable=True))
    op.add_column('carrier_line_item', sa.Column('confidence', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('carrier_line_item', 'confidence')
    op.drop_column('carrier_line_item', 'line_item_code')
    op.drop_column('carrier_estimate', 'parse_confidence')
    op.drop_column('carrier_estimate', 'parser_type')
