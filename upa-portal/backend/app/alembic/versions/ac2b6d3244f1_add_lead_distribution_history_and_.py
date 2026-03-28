"""add lead distribution history and rotation state tables

Revision ID: ac2b6d3244f1
Revises: 4c52f44a8aba
Create Date: 2026-03-07 11:35:15.923441

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ac2b6d3244f1'
down_revision = '4c52f44a8aba'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('territory_rotation_state',
    sa.Column('territory_id', sa.UUID(), nullable=False),
    sa.Column('last_assigned_agent_id', sa.UUID(), nullable=True),
    sa.Column('rotation_index', sa.Integer(), server_default='0', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['last_assigned_agent_id'], ['user.id'], name='fk_rotation_last_agent_id', ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['territory_id'], ['territory.id'], name='fk_rotation_territory_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_territory_rotation_state_territory_id'), 'territory_rotation_state', ['territory_id'], unique=True)
    op.create_table('lead_distribution_history',
    sa.Column('lead_id', sa.UUID(), nullable=False),
    sa.Column('territory_id', sa.UUID(), nullable=False),
    sa.Column('assigned_agent_id', sa.UUID(), nullable=False),
    sa.Column('lead_type', sa.String(length=30), nullable=False),
    sa.Column('distributed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['assigned_agent_id'], ['user.id'], name='fk_lead_dist_agent_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['lead_id'], ['lead.id'], name='fk_lead_dist_lead_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['territory_id'], ['territory.id'], name='fk_lead_dist_territory_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_lead_dist_type_territory', 'lead_distribution_history', ['lead_type', 'territory_id'], unique=False)
    op.create_index(op.f('ix_lead_distribution_history_assigned_agent_id'), 'lead_distribution_history', ['assigned_agent_id'], unique=False)
    op.create_index(op.f('ix_lead_distribution_history_lead_id'), 'lead_distribution_history', ['lead_id'], unique=False)
    op.create_index(op.f('ix_lead_distribution_history_lead_type'), 'lead_distribution_history', ['lead_type'], unique=False)
    op.create_index(op.f('ix_lead_distribution_history_territory_id'), 'lead_distribution_history', ['territory_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_lead_distribution_history_territory_id'), table_name='lead_distribution_history')
    op.drop_index(op.f('ix_lead_distribution_history_lead_type'), table_name='lead_distribution_history')
    op.drop_index(op.f('ix_lead_distribution_history_lead_id'), table_name='lead_distribution_history')
    op.drop_index(op.f('ix_lead_distribution_history_assigned_agent_id'), table_name='lead_distribution_history')
    op.drop_index('ix_lead_dist_type_territory', table_name='lead_distribution_history')
    op.drop_table('lead_distribution_history')
    op.drop_index(op.f('ix_territory_rotation_state_territory_id'), table_name='territory_rotation_state')
    op.drop_table('territory_rotation_state')
