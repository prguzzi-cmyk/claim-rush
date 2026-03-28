"""update property_intelligence fields: rename columns, add status

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-04 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7a8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('property_intelligence', 'property_value', new_column_name='property_value_estimate')
    op.alter_column('property_intelligence', 'insurance_probability', new_column_name='insurance_probability_score')
    op.add_column('property_intelligence', sa.Column('status', sa.String(length=30), nullable=False, server_default='pending'))


def downgrade() -> None:
    op.drop_column('property_intelligence', 'status')
    op.alter_column('property_intelligence', 'insurance_probability_score', new_column_name='insurance_probability')
    op.alter_column('property_intelligence', 'property_value_estimate', new_column_name='property_value')
