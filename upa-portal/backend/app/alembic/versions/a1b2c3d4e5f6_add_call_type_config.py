"""Add call_type_config table with seed data

Revision ID: a1b2c3d4e5f6
Revises: 47a0a214487b
Create Date: 2026-02-27 12:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '47a0a214487b'
branch_labels = None
depends_on = None

# Default call types to seed
CALL_TYPES = [
    {"code": "SF",  "description": "Structure Fire",       "is_enabled": True,  "sort_order": 0},
    {"code": "CF",  "description": "Commercial Fire",      "is_enabled": True,  "sort_order": 1},
    {"code": "BA",  "description": "Building Alarm",       "is_enabled": False, "sort_order": 2},
    {"code": "FF",  "description": "Forest/Wildland Fire",  "is_enabled": False, "sort_order": 3},
    {"code": "FA",  "description": "Fire Alarm",            "is_enabled": False, "sort_order": 4},
    {"code": "ME",  "description": "Medical Emergency",     "is_enabled": False, "sort_order": 5},
    {"code": "TC",  "description": "Traffic Collision",     "is_enabled": False, "sort_order": 6},
    {"code": "HA",  "description": "Hazmat",                "is_enabled": False, "sort_order": 7},
    {"code": "WF",  "description": "Wildland Fire",         "is_enabled": False, "sort_order": 8},
    {"code": "MV",  "description": "Motor Vehicle Accident", "is_enabled": False, "sort_order": 9},
    {"code": "RS",  "description": "Rescue",                "is_enabled": False, "sort_order": 10},
    {"code": "EMS", "description": "EMS Call",              "is_enabled": False, "sort_order": 11},
    {"code": "GF",  "description": "Grass Fire",            "is_enabled": False, "sort_order": 12},
    {"code": "CO",  "description": "Carbon Monoxide",       "is_enabled": False, "sort_order": 13},
    {"code": "OA",  "description": "Outside Alert",         "is_enabled": False, "sort_order": 14},
    {"code": "VF",  "description": "Vehicle Fire",          "is_enabled": False, "sort_order": 15},
]


def upgrade() -> None:
    table = op.create_table(
        'call_type_config',
        sa.Column('id', sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('description', sa.String(length=100), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_call_type_config_code'),
    )
    op.create_index('ix_call_type_config_code', 'call_type_config', ['code'])

    # Seed default call types
    op.bulk_insert(
        table,
        [
            {
                "id": uuid.uuid4(),
                "code": ct["code"],
                "description": ct["description"],
                "is_enabled": ct["is_enabled"],
                "sort_order": ct["sort_order"],
            }
            for ct in CALL_TYPES
        ],
    )


def downgrade() -> None:
    op.drop_index('ix_call_type_config_code', table_name='call_type_config')
    op.drop_table('call_type_config')
