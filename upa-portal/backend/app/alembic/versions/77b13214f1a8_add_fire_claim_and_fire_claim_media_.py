"""add fire_claim and fire_claim_media tables

Revision ID: 77b13214f1a8
Revises: c4d5e6f7a8b9
Create Date: 2026-03-05 14:33:51.952521

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '77b13214f1a8'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('fire_claim',
    sa.Column('claim_number', sa.String(length=50), nullable=True),
    sa.Column('loss_date', sa.Date(), nullable=False),
    sa.Column('address_line1', sa.String(length=255), nullable=False),
    sa.Column('address_line2', sa.String(length=255), nullable=True),
    sa.Column('city', sa.String(length=100), nullable=False),
    sa.Column('state', sa.String(length=2), nullable=False),
    sa.Column('zip', sa.String(length=10), nullable=False),
    sa.Column('insured_name', sa.String(length=200), nullable=False),
    sa.Column('insured_phone', sa.String(length=20), nullable=False),
    sa.Column('insured_email', sa.String(length=200), nullable=False),
    sa.Column('carrier_name', sa.String(length=200), nullable=True),
    sa.Column('policy_number', sa.String(length=100), nullable=True),
    sa.Column('origin_area', sa.String(length=30), nullable=False),
    sa.Column('origin_area_other', sa.String(length=200), nullable=True),
    sa.Column('rooms_affected', sa.Text(), nullable=False),
    sa.Column('smoke_level', sa.String(length=20), nullable=False),
    sa.Column('water_from_suppression', sa.Boolean(), nullable=False),
    sa.Column('roof_opened_by_firefighters', sa.Boolean(), nullable=False),
    sa.Column('power_shut_off', sa.Boolean(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('updated_by_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_fire_claim_created_by_id'),
    sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'], name='fk_fire_claim_updated_by_id'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_table('fire_claim_media',
    sa.Column('fire_claim_id', sa.UUID(), nullable=False),
    sa.Column('media_type', sa.String(length=10), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=False),
    sa.Column('file_url', sa.String(length=500), nullable=False),
    sa.Column('caption', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['fire_claim_id'], ['fire_claim.id'], name='fk_fire_claim_media_fire_claim_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )


def downgrade() -> None:
    op.drop_table('fire_claim_media')
    op.drop_table('fire_claim')
