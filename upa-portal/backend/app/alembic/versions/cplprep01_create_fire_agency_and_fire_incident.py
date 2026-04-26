"""create fire_agency and fire_incident base tables

The chain after this point (c3d4e5f6a7b8 onward) ALTERs fire_incident and
references fire_agency as an FK target, but no upstream migration creates
either table — the original developer assumed they existed in production
from a pre-chain provenance that was never actually shipped. Restoring a
production snapshot to staging proved both tables are absent in prod too.

This migration creates them in their pre-c3d4e5f6a7b8 shape:
  - fire_agency: full model schema (no later migrations touch it)
  - fire_incident: only the columns existing BEFORE c3d4e5f6a7b8 ran. Later
    migrations add data_source/external_id/source_url (c3d4e5f6a7b8),
    source_id (c4d5e6f7a8b9), dispatch_status/cleared_at (d1s2p3a4t5c6),
    lead_id (e5f6a7b8c9d0), and auto_lead_* (f0a1b2c3d4e5).

Revision ID: cplprep01
Revises: b2c3d4e5f6a7
Create Date: 2026-04-26 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'cplprep01'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'fire_agency',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('agency_id', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('state', sa.String(2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_polled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.Uuid(), nullable=True),
        sa.Column('updated_by_id', sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agency_id', name='uq_fire_agency_agency_id'),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id'], name='fk_fire_agency_created_by_id'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['user.id'], name='fk_fire_agency_updated_by_id'),
    )
    op.create_index('ix_fire_agency_agency_id', 'fire_agency', ['agency_id'])

    op.create_table(
        'fire_incident',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('pulsepoint_id', sa.String(100), nullable=False),
        sa.Column('call_type', sa.String(20), nullable=False),
        sa.Column('call_type_description', sa.String(100), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('units', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('agency_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agency_id'], ['fire_agency.id'], name='fk_fire_incident_agency_id', ondelete='CASCADE'),
        sa.UniqueConstraint('pulsepoint_id', 'agency_id', name='uq_fire_incident_pulsepoint_agency'),
    )
    op.create_index('ix_fire_incident_pulsepoint_id', 'fire_incident', ['pulsepoint_id'])


def downgrade() -> None:
    op.drop_index('ix_fire_incident_pulsepoint_id', table_name='fire_incident')
    op.drop_table('fire_incident')
    op.drop_index('ix_fire_agency_agency_id', table_name='fire_agency')
    op.drop_table('fire_agency')
