"""add property_intelligence table

Revision ID: a2b3c4d5e6f7
Revises: 765b840487e8
Create Date: 2026-03-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = '765b840487e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'property_intelligence',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('incident_id', sa.UUID(), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=False),
        sa.Column('owner_name', sa.String(length=200), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('phone_type', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=200), nullable=True),
        sa.Column('property_value', sa.String(length=100), nullable=True),
        sa.Column('mortgage_lender', sa.String(length=200), nullable=True),
        sa.Column('insurance_probability', sa.String(length=50), nullable=True),
        sa.Column('raw_residents', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['incident_id'], ['fire_incident.id'], name='fk_property_intel_incident_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_property_intelligence_incident_id', 'property_intelligence', ['incident_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_property_intelligence_incident_id', table_name='property_intelligence')
    op.drop_table('property_intelligence')
